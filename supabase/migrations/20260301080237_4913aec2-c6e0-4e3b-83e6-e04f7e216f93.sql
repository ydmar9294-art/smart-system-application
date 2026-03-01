
-- ==========================================
-- Account Deletion Requests (Hierarchical Approval)
-- ==========================================

CREATE TABLE public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  requester_employee_type TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  approver_id UUID,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can read their own requests
CREATE POLICY "Requesters can read own deletion requests"
ON public.account_deletion_requests
FOR SELECT
USING (requester_id = auth.uid());

-- Requesters can insert their own requests
CREATE POLICY "Users can submit deletion request"
ON public.account_deletion_requests
FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND organization_id = get_my_org_id()
);

-- Sales Managers can see requests from FIELD_AGENT and WAREHOUSE_KEEPER in their org
CREATE POLICY "Sales managers can read subordinate requests"
ON public.account_deletion_requests
FOR SELECT
USING (
  organization_id = get_my_org_id()
  AND get_my_role() = 'EMPLOYEE'
  AND requester_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND employee_type = 'SALES_MANAGER'
  )
);

-- Owners can see requests from SALES_MANAGER and ACCOUNTANT in their org
CREATE POLICY "Owners can read subordinate requests"
ON public.account_deletion_requests
FOR SELECT
USING (
  organization_id = get_my_org_id()
  AND get_my_role() = 'OWNER'
  AND requester_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT')
);

-- Developers can see all requests
CREATE POLICY "Developers can read all deletion requests"
ON public.account_deletion_requests
FOR SELECT
USING (is_developer());

-- Approvers can update status (approve/reject)
CREATE POLICY "Approvers can update deletion requests"
ON public.account_deletion_requests
FOR UPDATE
USING (
  organization_id = get_my_org_id()
  AND status = 'PENDING'
  AND (
    -- Sales Manager approves FIELD_AGENT/WAREHOUSE_KEEPER
    (get_my_role() = 'EMPLOYEE' AND requester_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER')
     AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND employee_type = 'SALES_MANAGER'))
    OR
    -- Owner approves SALES_MANAGER/ACCOUNTANT
    (get_my_role() = 'OWNER' AND requester_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT'))
  )
);

-- Developers can update any request
CREATE POLICY "Developers can update deletion requests"
ON public.account_deletion_requests
FOR UPDATE
USING (is_developer());

-- ==========================================
-- RPC: Submit account deletion request
-- ==========================================
CREATE OR REPLACE FUNCTION public.submit_account_deletion_request(p_reason TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_request_id UUID;
  v_approver_type TEXT;
  v_approver_ids UUID[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مسجل دخول');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'الملف الشخصي غير موجود');
  END IF;

  -- Developers cannot delete themselves
  IF v_profile.role = 'DEVELOPER' THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يمكن حذف حساب المطور');
  END IF;

  -- Owners use org deletion flow (existing)
  IF v_profile.role = 'OWNER' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يرجى استخدام طلب حذف المنشأة بدلاً من ذلك');
  END IF;

  -- Check for existing pending request
  IF EXISTS (
    SELECT 1 FROM account_deletion_requests
    WHERE requester_id = v_user_id AND status = 'PENDING'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'يوجد طلب حذف معلق بالفعل');
  END IF;

  -- Insert the request
  INSERT INTO account_deletion_requests (
    requester_id, requester_name, requester_role,
    requester_employee_type, organization_id, reason
  ) VALUES (
    v_user_id, v_profile.full_name, v_profile.role,
    v_profile.employee_type, v_profile.organization_id, p_reason
  ) RETURNING id INTO v_request_id;

  -- Determine approver(s) and notify them
  IF v_profile.employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER') THEN
    -- Notify Sales Managers
    SELECT array_agg(id) INTO v_approver_ids
    FROM profiles
    WHERE organization_id = v_profile.organization_id
      AND role = 'EMPLOYEE' AND employee_type = 'SALES_MANAGER' AND is_active = true;
  ELSIF v_profile.employee_type IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
    -- Notify Owner
    SELECT array_agg(id) INTO v_approver_ids
    FROM profiles
    WHERE organization_id = v_profile.organization_id
      AND role = 'OWNER' AND is_active = true;
  END IF;

  -- Create notifications for approvers
  IF v_approver_ids IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, title, description, type, data)
    SELECT
      unnest(v_approver_ids),
      'طلب حذف حساب',
      'قدّم ' || v_profile.full_name || ' طلب حذف حسابه. يرجى مراجعته.',
      'warning',
      jsonb_build_object('request_id', v_request_id, 'action', 'account_deletion_request');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب الحذف بنجاح. سيتم مراجعته من قبل المسؤول.', 'request_id', v_request_id);
END;
$$;

-- ==========================================
-- RPC: Approve or Reject account deletion request
-- ==========================================
CREATE OR REPLACE FUNCTION public.decide_account_deletion_request(
  p_request_id UUID,
  p_decision TEXT,  -- 'APPROVED' or 'REJECTED'
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_approver_id UUID;
  v_approver RECORD;
  v_request RECORD;
  v_result jsonb;
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

  -- Permission check: hierarchy
  IF v_request.requester_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER') THEN
    IF NOT (v_approver.role = 'EMPLOYEE' AND v_approver.employee_type = 'SALES_MANAGER'
            AND v_approver.organization_id = v_request.organization_id) THEN
      RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالقرار على هذا الطلب');
    END IF;
  ELSIF v_request.requester_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
    IF NOT (v_approver.role = 'OWNER' AND v_approver.organization_id = v_request.organization_id) THEN
      RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالقرار على هذا الطلب');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'نوع الحساب غير مدعوم');
  END IF;

  IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN jsonb_build_object('success', false, 'message', 'قرار غير صالح');
  END IF;

  -- Update the request
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

  -- If approved, execute deletion immediately
  IF p_decision = 'APPROVED' THEN
    -- Audit log
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

    -- Remove user data (same as delete_own_account_rpc)
    DELETE FROM user_notifications WHERE user_id = v_request.requester_id;
    DELETE FROM user_consents WHERE user_id = v_request.requester_id;
    DELETE FROM devices WHERE user_id = v_request.requester_id;

    -- Anonymize profile
    UPDATE profiles SET
      full_name = 'حساب محذوف',
      email = NULL,
      phone = NULL,
      is_active = false,
      license_key = NULL
    WHERE id = v_request.requester_id;

    -- Mark request as executed
    UPDATE account_deletion_requests SET executed_at = now() WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message',
    CASE WHEN p_decision = 'APPROVED' THEN 'تمت الموافقة وتم حذف الحساب بنجاح'
         ELSE 'تم رفض الطلب بنجاح' END
  );
END;
$$;
