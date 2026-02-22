
-- SECTION 4: Employee Deactivation System
-- Add is_active column to profiles table to support deactivation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create index for active employee queries
CREATE INDEX IF NOT EXISTS idx_profiles_org_active ON public.profiles(organization_id, is_active) WHERE is_active = true;

-- Create RPC to deactivate an employee (Owner deactivates SM/Accountant, SM deactivates FA/WK)
CREATE OR REPLACE FUNCTION public.deactivate_employee_rpc(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role user_role;
  v_caller_employee_type employee_type;
  v_caller_org_id uuid;
  v_target_org_id uuid;
  v_target_role user_role;
  v_target_employee_type employee_type;
  v_target_is_active boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'غير مسجل الدخول');
  END IF;

  -- Get caller info
  SELECT role, employee_type, organization_id INTO v_caller_role, v_caller_employee_type, v_caller_org_id
  FROM profiles WHERE id = v_caller_id;

  -- Get target info
  SELECT role, employee_type, organization_id, is_active INTO v_target_role, v_target_employee_type, v_target_org_id, v_target_is_active
  FROM profiles WHERE id = p_employee_id;

  IF v_target_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'الموظف غير موجود');
  END IF;

  -- Must be same org
  IF v_caller_org_id != v_target_org_id THEN
    RETURN json_build_object('success', false, 'message', 'لا يمكن إدارة موظف من منشأة أخرى');
  END IF;

  -- Already inactive
  IF NOT v_target_is_active THEN
    RETURN json_build_object('success', false, 'message', 'الموظف معطل بالفعل');
  END IF;

  -- Owner can deactivate SM and Accountant
  IF v_caller_role = 'OWNER' AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
    UPDATE profiles SET is_active = false, updated_at = now() WHERE id = p_employee_id;
    
    -- Log audit
    PERFORM log_audit_event(
      p_user_id := v_caller_id,
      p_action := 'DEACTIVATE_EMPLOYEE',
      p_resource_type := 'profile',
      p_resource_id := p_employee_id::text,
      p_organization_id := v_caller_org_id,
      p_severity := 'warning',
      p_details := json_build_object('employee_type', v_target_employee_type::text)::jsonb
    );
    
    RETURN json_build_object('success', true, 'message', 'تم تعطيل الموظف بنجاح');
  END IF;

  -- Sales Manager can deactivate FA and WK
  IF v_caller_role = 'EMPLOYEE' AND v_caller_employee_type = 'SALES_MANAGER' 
     AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER') THEN
    UPDATE profiles SET is_active = false, updated_at = now() WHERE id = p_employee_id;
    
    PERFORM log_audit_event(
      p_user_id := v_caller_id,
      p_action := 'DEACTIVATE_EMPLOYEE',
      p_resource_type := 'profile',
      p_resource_id := p_employee_id::text,
      p_organization_id := v_caller_org_id,
      p_severity := 'warning',
      p_details := json_build_object('employee_type', v_target_employee_type::text)::jsonb
    );
    
    RETURN json_build_object('success', true, 'message', 'تم تعطيل الموظف بنجاح');
  END IF;

  RETURN json_build_object('success', false, 'message', 'ليس لديك صلاحية لتعطيل هذا الموظف');
END;
$$;

-- Create RPC to reactivate an employee
CREATE OR REPLACE FUNCTION public.reactivate_employee_rpc(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role user_role;
  v_caller_employee_type employee_type;
  v_caller_org_id uuid;
  v_target_org_id uuid;
  v_target_role user_role;
  v_target_employee_type employee_type;
  v_target_is_active boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'غير مسجل الدخول');
  END IF;

  SELECT role, employee_type, organization_id INTO v_caller_role, v_caller_employee_type, v_caller_org_id
  FROM profiles WHERE id = v_caller_id;

  SELECT role, employee_type, organization_id, is_active INTO v_target_role, v_target_employee_type, v_target_org_id, v_target_is_active
  FROM profiles WHERE id = p_employee_id;

  IF v_target_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'الموظف غير موجود');
  END IF;

  IF v_caller_org_id != v_target_org_id THEN
    RETURN json_build_object('success', false, 'message', 'لا يمكن إدارة موظف من منشأة أخرى');
  END IF;

  IF v_target_is_active THEN
    RETURN json_build_object('success', false, 'message', 'الموظف نشط بالفعل');
  END IF;

  -- Same permission check as deactivation
  IF v_caller_role = 'OWNER' AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
    UPDATE profiles SET is_active = true, updated_at = now() WHERE id = p_employee_id;
    RETURN json_build_object('success', true, 'message', 'تم إعادة تنشيط الموظف بنجاح');
  END IF;

  IF v_caller_role = 'EMPLOYEE' AND v_caller_employee_type = 'SALES_MANAGER' 
     AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER') THEN
    UPDATE profiles SET is_active = true, updated_at = now() WHERE id = p_employee_id;
    RETURN json_build_object('success', true, 'message', 'تم إعادة تنشيط الموظف بنجاح');
  END IF;

  RETURN json_build_object('success', false, 'message', 'ليس لديك صلاحية لإعادة تنشيط هذا الموظف');
END;
$$;

-- Update add_employee_rpc to check active employee count against max_employees
-- The existing function already checks this via the license, so we update the count logic
-- to only count ACTIVE employees
CREATE OR REPLACE FUNCTION public.get_active_employee_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer 
  FROM profiles 
  WHERE organization_id = p_org_id 
    AND role = 'EMPLOYEE' 
    AND is_active = true;
$$;

-- Update the auth-status edge function's access check:
-- Block inactive users from accessing the system
-- We'll handle this in the edge function code
