
-- Fix: audit_logs FK blocks org deletion. Change to ON DELETE SET NULL.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_organization_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Also fix deletion_requests FK to SET NULL (org gets deleted)
ALTER TABLE public.deletion_requests DROP CONSTRAINT IF EXISTS deletion_requests_organization_id_fkey;
ALTER TABLE public.deletion_requests ADD CONSTRAINT deletion_requests_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Update execute_org_deletion_rpc: remove verification requirement, developer just approves directly
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

  -- AUDIT LOG (permanent, before deletion)
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

  -- CASCADING DELETION
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = v_request.organization_id);
  DELETE FROM collections WHERE organization_id = v_request.organization_id;
  DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM sales_returns WHERE organization_id = v_request.organization_id;
  DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM purchase_returns WHERE organization_id = v_request.organization_id;
  DELETE FROM sales WHERE organization_id = v_request.organization_id;
  DELETE FROM purchases WHERE organization_id = v_request.organization_id;
  DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM deliveries WHERE organization_id = v_request.organization_id);
  DELETE FROM deliveries WHERE organization_id = v_request.organization_id;
  DELETE FROM distributor_inventory WHERE organization_id = v_request.organization_id;
  DELETE FROM stock_movements WHERE organization_id = v_request.organization_id;
  DELETE FROM customers WHERE organization_id = v_request.organization_id;
  DELETE FROM products WHERE organization_id = v_request.organization_id;
  DELETE FROM invoice_snapshots WHERE organization_id = v_request.organization_id;
  DELETE FROM pending_employees WHERE organization_id = v_request.organization_id;
  DELETE FROM organization_legal_info WHERE organization_id = v_request.organization_id;
  DELETE FROM profiles WHERE organization_id = v_request.organization_id;
  DELETE FROM developer_licenses WHERE organization_id = v_request.organization_id;

  -- Mark as executed
  UPDATE deletion_requests SET
    approval_status = 'EXECUTED',
    verification_status = 'VERIFIED',
    executed_at = now(),
    executed_by = v_developer_id
  WHERE id = p_deletion_request_id;

  -- Delete the organization (audit_logs FK is now SET NULL, so it won't block)
  DELETE FROM organizations WHERE id = v_request.organization_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف المنشأة بالكامل: ' || v_org_name);
END;
$function$;
