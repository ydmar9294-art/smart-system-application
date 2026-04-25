
-- ============================================
-- FIX 1: Allow OWNER to approve FIELD_AGENT/WAREHOUSE_KEEPER deletion requests
-- (since SALES_MANAGER role no longer exists, OWNER handles all employees)
-- ============================================
CREATE OR REPLACE FUNCTION public.decide_account_deletion_request(
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_approver_id UUID;
  v_approver RECORD;
  v_request RECORD;
BEGIN
  v_approver_id := auth.uid();

  SELECT * INTO v_approver FROM profiles WHERE id = v_approver_id;
  IF v_approver IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مسجل دخول');
  END IF;

  SELECT * INTO v_request FROM account_deletion_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  END IF;

  IF v_request.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم اتخاذ قرار بشأن هذا الطلب مسبقاً');
  END IF;

  -- Permission: OWNER (إدارة) approves ALL employee deletion requests in their org.
  -- DEVELOPER can approve anywhere.
  IF NOT (
    (v_approver.role = 'OWNER' AND v_approver.organization_id = v_request.organization_id)
    OR (v_approver.role = 'DEVELOPER')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالقرار على هذا الطلب');
  END IF;

  IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN jsonb_build_object('success', false, 'message', 'قرار غير صالح');
  END IF;

  UPDATE account_deletion_requests
  SET status = p_decision,
      approver_id = v_approver_id,
      decision_note = p_note,
      decided_at = now()
  WHERE id = p_request_id;

  -- Notify requester
  INSERT INTO user_notifications (user_id, title, description, type, data)
  VALUES (
    v_request.requester_id,
    CASE WHEN p_decision = 'APPROVED' THEN 'تمت الموافقة على طلب حذف حسابك'
         ELSE 'تم رفض طلب حذف حسابك' END,
    CASE WHEN p_decision = 'APPROVED' THEN 'تمت الموافقة على طلب حذف حسابك وسيتم تنفيذه قريباً.'
         ELSE 'تم رفض طلب حذف حسابك. السبب: ' || COALESCE(p_note, 'لم يتم تحديد سبب') END,
    CASE WHEN p_decision = 'APPROVED' THEN 'info' ELSE 'warning' END,
    jsonb_build_object('request_id', p_request_id, 'action', 'account_deletion_decision', 'decision', p_decision)
  );

  IF p_decision = 'APPROVED' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (v_request.organization_id, v_approver_id, 'ACCOUNT_DELETION_APPROVED', 'profile', v_request.requester_id,
      jsonb_build_object(
        'requester_name', v_request.requester_name,
        'requester_role', v_request.requester_role,
        'requester_type', v_request.requester_employee_type,
        'approved_by', v_approver_id,
        'reason', v_request.reason,
        'note', p_note
      )
    );

    -- Cleanup user-level data
    DELETE FROM user_notifications WHERE user_id = v_request.requester_id;
    DELETE FROM user_consents WHERE user_id = v_request.requester_id;
    DELETE FROM devices WHERE user_id = v_request.requester_id;
    -- Clean optional ancillary data that might block FK on profiles
    DELETE FROM distributor_locations WHERE user_id = v_request.requester_id;
    DELETE FROM distributor_inventory WHERE distributor_id = v_request.requester_id;

    UPDATE profiles SET
      full_name = 'حساب محذوف',
      email = NULL,
      phone = NULL,
      is_active = false,
      license_key = NULL
    WHERE id = v_request.requester_id;

    UPDATE account_deletion_requests SET executed_at = now() WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message',
    CASE WHEN p_decision = 'APPROVED' THEN 'تمت الموافقة وتم حذف الحساب بنجاح'
         ELSE 'تم رفض الطلب بنجاح' END
  );
END;
$function$;

-- ============================================
-- FIX 2: Cascade delete all org-related rows when developer executes org deletion
-- Resolves the FK violation on distributor_locations and similar tables.
-- ============================================
CREATE OR REPLACE FUNCTION public.execute_org_deletion_rpc(
  p_deletion_request_id uuid,
  p_confirmation_org_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_caller RECORD;
  v_request RECORD;
  v_org RECORD;
  v_org_name TEXT;
  v_user_ids UUID[];
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_caller FROM profiles WHERE id = v_caller_id;
  IF v_caller IS NULL OR v_caller.role <> 'DEVELOPER' THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;

  SELECT * INTO v_request FROM deletion_requests WHERE id = p_deletion_request_id;
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  END IF;

  IF v_request.approval_status = 'EXECUTED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم تنفيذ هذا الطلب مسبقاً');
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_request.organization_id;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'المنشأة غير موجودة');
  END IF;

  v_org_name := v_org.name;
  IF v_org_name IS DISTINCT FROM p_confirmation_org_name THEN
    RETURN jsonb_build_object('success', false, 'message', 'اسم المنشأة غير مطابق');
  END IF;

  -- Collect all user ids belonging to this org for user-scoped cleanup
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_user_ids
  FROM profiles WHERE organization_id = v_org.id;

  -- ── Org-scoped cleanup (in dependency order) ──
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = v_org.id);
  DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE organization_id = v_org.id);
  DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE organization_id = v_org.id);
  DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM deliveries WHERE organization_id = v_org.id);
  DELETE FROM route_stops WHERE route_id IN (SELECT id FROM routes WHERE organization_id = v_org.id);

  DELETE FROM sales WHERE organization_id = v_org.id;
  DELETE FROM sales_returns WHERE organization_id = v_org.id;
  DELETE FROM purchase_returns WHERE organization_id = v_org.id;
  DELETE FROM purchases WHERE organization_id = v_org.id;
  DELETE FROM deliveries WHERE organization_id = v_org.id;
  DELETE FROM routes WHERE organization_id = v_org.id;

  DELETE FROM collections WHERE organization_id = v_org.id;
  DELETE FROM customers WHERE organization_id = v_org.id;
  DELETE FROM distributor_inventory WHERE organization_id = v_org.id;
  DELETE FROM distributor_locations WHERE organization_id = v_org.id;
  DELETE FROM products WHERE organization_id = v_org.id;
  DELETE FROM invoice_snapshots WHERE organization_id = v_org.id;
  DELETE FROM price_change_history WHERE organization_id = v_org.id;
  DELETE FROM exchange_rates WHERE organization_id = v_org.id;
  DELETE FROM org_currencies WHERE organization_id = v_org.id;
  DELETE FROM organization_legal_info WHERE organization_id = v_org.id;
  DELETE FROM alert_settings WHERE organization_id = v_org.id;
  DELETE FROM pending_employees WHERE organization_id = v_org.id;
  DELETE FROM account_deletion_requests WHERE organization_id = v_org.id;
  DELETE FROM developer_licenses WHERE organization_id = v_org.id;
  DELETE FROM audit_logs WHERE organization_id = v_org.id;

  -- ── User-scoped cleanup (devices, notifications, consents) ──
  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    DELETE FROM user_notifications WHERE user_id = ANY(v_user_ids);
    DELETE FROM user_consents WHERE user_id = ANY(v_user_ids);
    DELETE FROM devices WHERE user_id = ANY(v_user_ids);
    -- Anonymize profiles instead of deleting (auth.users untouched)
    UPDATE profiles SET
      full_name = 'حساب محذوف',
      email = NULL,
      phone = NULL,
      is_active = false,
      license_key = NULL,
      organization_id = NULL
    WHERE id = ANY(v_user_ids);
  END IF;

  -- ── Finally remove the organization ──
  DELETE FROM organizations WHERE id = v_org.id;

  -- Mark request as executed
  UPDATE deletion_requests
  SET approval_status = 'EXECUTED',
      executed_at = now(),
      executed_by = v_caller_id,
      approved_at = COALESCE(approved_at, now())
  WHERE id = p_deletion_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف المنشأة وكل بياناتها بنجاح');
END;
$function$;

-- ============================================
-- FIX 3: Ensure owner-side org-deletion request notifies developers (no-op if exists)
-- (No schema change needed; tables already in place.)
-- ============================================
