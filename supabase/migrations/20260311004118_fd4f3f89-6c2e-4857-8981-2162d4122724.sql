
-- Fix execute_org_deletion_rpc: add missing price_change_history, account_deletion_requests,
-- subscription_payments, devices, and user_notifications deletions before products/profiles/org

CREATE OR REPLACE FUNCTION public.execute_org_deletion_rpc(p_deletion_request_id uuid, p_confirmation_org_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_org_name TEXT;
  v_developer_id UUID;
  v_user_ids UUID[];
BEGIN
  v_developer_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_developer_id AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT dr.*, o.name AS actual_org_name
  INTO v_request
  FROM deletion_requests dr
  JOIN organizations o ON o.id = dr.organization_id
  WHERE dr.id = p_deletion_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب الحذف غير موجود');
  END IF;

  IF v_request.approval_status = 'EXECUTED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم تنفيذ هذا الطلب مسبقاً');
  END IF;

  IF v_request.approval_status = 'REJECTED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'هذا الطلب مرفوض');
  END IF;

  IF p_confirmation_org_name != v_request.actual_org_name THEN
    RETURN jsonb_build_object('success', false, 'message', 'اسم المنشأة غير مطابق');
  END IF;

  v_org_name := v_request.actual_org_name;

  -- Collect all user IDs in this org (needed for user-scoped tables)
  SELECT array_agg(id) INTO v_user_ids FROM profiles WHERE organization_id = v_request.organization_id;

  -- AUDIT LOG (permanent, before deletion - FK is SET NULL so survives org delete)
  INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_request.organization_id,
    v_developer_id,
    'PERMANENT_DELETION',
    'organization',
    v_request.organization_id,
    jsonb_build_object(
      'org_name', v_org_name,
      'owner_id', v_request.owner_id,
      'deletion_request_id', p_deletion_request_id,
      'request_method', v_request.request_method,
      'request_date', v_request.request_date,
      'executed_by', v_developer_id,
      'executed_at', now()
    )
  );

  -- =============================================
  -- CASCADING DELETION (correct dependency order)
  -- =============================================

  -- 1. Items tables (depend on parent sale/return/delivery)
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = v_request.organization_id);
  DELETE FROM collections WHERE organization_id = v_request.organization_id;
  DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM deliveries WHERE organization_id = v_request.organization_id);

  -- 2. Parent transaction tables
  DELETE FROM sales_returns WHERE organization_id = v_request.organization_id;
  DELETE FROM purchase_returns WHERE organization_id = v_request.organization_id;
  DELETE FROM sales WHERE organization_id = v_request.organization_id;
  DELETE FROM purchases WHERE organization_id = v_request.organization_id;
  DELETE FROM deliveries WHERE organization_id = v_request.organization_id;

  -- 3. Inventory
  DELETE FROM distributor_inventory WHERE organization_id = v_request.organization_id;
  DELETE FROM stock_movements WHERE organization_id = v_request.organization_id;

  -- 4. ** FIX: price_change_history must be deleted BEFORE products **
  DELETE FROM price_change_history WHERE organization_id = v_request.organization_id;

  -- 5. Core entities
  DELETE FROM customers WHERE organization_id = v_request.organization_id;
  DELETE FROM products WHERE organization_id = v_request.organization_id;
  DELETE FROM invoice_snapshots WHERE organization_id = v_request.organization_id;

  -- 6. Employee / org config
  DELETE FROM pending_employees WHERE organization_id = v_request.organization_id;
  DELETE FROM organization_legal_info WHERE organization_id = v_request.organization_id;
  DELETE FROM account_deletion_requests WHERE organization_id = v_request.organization_id;
  DELETE FROM subscription_payments WHERE organization_id = v_request.organization_id;

  -- 7. User-scoped tables (devices, notifications, consents)
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM devices WHERE user_id = ANY(v_user_ids);
    DELETE FROM user_notifications WHERE user_id = ANY(v_user_ids);
    DELETE FROM user_consents WHERE user_id = ANY(v_user_ids);
  END IF;

  -- 8. Profiles & licenses
  DELETE FROM profiles WHERE organization_id = v_request.organization_id;
  DELETE FROM developer_licenses WHERE organization_id = v_request.organization_id;

  -- 9. Mark deletion request as executed
  UPDATE deletion_requests SET
    approval_status = 'EXECUTED',
    verification_status = 'VERIFIED',
    executed_at = now(),
    executed_by = v_developer_id
  WHERE id = p_deletion_request_id;

  -- 10. Delete the organization (audit_logs FK is SET NULL, deletion_requests FK is SET NULL)
  DELETE FROM organizations WHERE id = v_request.organization_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف المنشأة بالكامل: ' || v_org_name);
END;
$function$;
