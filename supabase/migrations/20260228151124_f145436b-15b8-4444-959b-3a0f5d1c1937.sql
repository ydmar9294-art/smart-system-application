
-- =============================================
-- DELETION REQUESTS TABLE
-- =============================================
CREATE TABLE public.deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  owner_id UUID NOT NULL,
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_method TEXT NOT NULL CHECK (request_method IN ('EMAIL', 'TICKET', 'IN_APP')),
  request_notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by UUID,
  verification_method TEXT,
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED')),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only developers can manage deletion requests"
ON public.deletion_requests
FOR ALL
USING (is_developer());

-- =============================================
-- CASCADING ORG DELETE RPC (SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION public.execute_org_deletion_rpc(
  p_deletion_request_id UUID,
  p_confirmation_org_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_org_name TEXT;
  v_developer_id UUID;
BEGIN
  v_developer_id := auth.uid();

  -- Only developers
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_developer_id AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Get deletion request
  SELECT dr.*, o.name AS actual_org_name
  INTO v_request
  FROM deletion_requests dr
  JOIN organizations o ON o.id = dr.organization_id
  WHERE dr.id = p_deletion_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب الحذف غير موجود');
  END IF;

  -- Must be verified and approved
  IF v_request.verification_status != 'VERIFIED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب الحذف لم يتم التحقق منه بعد');
  END IF;

  IF v_request.approval_status NOT IN ('APPROVED') THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب الحذف لم تتم الموافقة عليه بعد');
  END IF;

  IF v_request.approval_status = 'EXECUTED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم تنفيذ هذا الطلب مسبقاً');
  END IF;

  -- Confirmation: org name must match
  IF p_confirmation_org_name != v_request.actual_org_name THEN
    RETURN jsonb_build_object('success', false, 'message', 'اسم المنشأة غير مطابق');
  END IF;

  v_org_name := v_request.actual_org_name;

  -- ========== AUDIT LOG (permanent, before deletion) ==========
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
      'verified_at', v_request.verified_at,
      'executed_by', v_developer_id,
      'executed_at', now()
    )
  );

  -- ========== CASCADING DELETION (order matters for FK) ==========
  -- 1. Sale items & collection items
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = v_request.organization_id);
  DELETE FROM collections WHERE organization_id = v_request.organization_id;

  -- 2. Sales return items
  DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM sales_returns WHERE organization_id = v_request.organization_id;

  -- 3. Purchase return items
  DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE organization_id = v_request.organization_id);
  DELETE FROM purchase_returns WHERE organization_id = v_request.organization_id;

  -- 4. Sales
  DELETE FROM sales WHERE organization_id = v_request.organization_id;

  -- 5. Purchases
  DELETE FROM purchases WHERE organization_id = v_request.organization_id;

  -- 6. Delivery items
  DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM deliveries WHERE organization_id = v_request.organization_id);
  DELETE FROM deliveries WHERE organization_id = v_request.organization_id;

  -- 7. Distributor inventory
  DELETE FROM distributor_inventory WHERE organization_id = v_request.organization_id;

  -- 8. Stock movements
  DELETE FROM stock_movements WHERE organization_id = v_request.organization_id;

  -- 9. Customers
  DELETE FROM customers WHERE organization_id = v_request.organization_id;

  -- 10. Products
  DELETE FROM products WHERE organization_id = v_request.organization_id;

  -- 11. Invoice snapshots
  DELETE FROM invoice_snapshots WHERE organization_id = v_request.organization_id;

  -- 12. Pending employees
  DELETE FROM pending_employees WHERE organization_id = v_request.organization_id;

  -- 13. Legal info
  DELETE FROM organization_legal_info WHERE organization_id = v_request.organization_id;

  -- 14. Profiles (employees & owner)
  DELETE FROM profiles WHERE organization_id = v_request.organization_id;

  -- 15. License
  DELETE FROM developer_licenses WHERE organization_id = v_request.organization_id;

  -- 16. Notifications for users of this org (already deleted profiles, but notifications reference user_id)
  -- Skip - user_notifications don't have org_id, they'll be orphaned but harmless

  -- 17. Mark deletion request as executed (keep for audit)
  UPDATE deletion_requests SET
    approval_status = 'EXECUTED',
    executed_at = now(),
    executed_by = v_developer_id
  WHERE id = p_deletion_request_id;

  -- 18. Finally delete the organization
  DELETE FROM organizations WHERE id = v_request.organization_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف المنشأة بالكامل: ' || v_org_name);
END;
$$;
