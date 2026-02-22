
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
  v_active_count integer;
  v_max_employees integer;
  v_license_key text;
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

  -- Permission check (same as before)
  IF NOT (
    (v_caller_role = 'OWNER' AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT'))
    OR
    (v_caller_role = 'EMPLOYEE' AND v_caller_employee_type = 'SALES_MANAGER' 
     AND v_target_role = 'EMPLOYEE' AND v_target_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER'))
  ) THEN
    RETURN json_build_object('success', false, 'message', 'ليس لديك صلاحية لإعادة تنشيط هذا الموظف');
  END IF;

  -- License limit check with row-level locking to prevent race conditions
  SELECT p.license_key INTO v_license_key
  FROM profiles p WHERE p.id = (
    SELECT ou.user_id FROM organization_users ou 
    WHERE ou.organization_id = v_target_org_id AND ou.role = 'OWNER' LIMIT 1
  );

  IF v_license_key IS NOT NULL THEN
    SELECT dl.max_employees INTO v_max_employees
    FROM developer_licenses dl WHERE dl."licenseKey" = v_license_key FOR UPDATE;
  END IF;

  IF v_max_employees IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM profiles WHERE organization_id = v_target_org_id AND is_active = true;

    IF v_active_count >= v_max_employees THEN
      RETURN json_build_object('success', false, 'message', 'تم الوصول إلى الحد الأقصى لعدد الموظفين النشطين. يرجى التواصل مع المطور لزيادة الحد.');
    END IF;
  END IF;

  -- Reactivate
  UPDATE profiles SET is_active = true, updated_at = now() WHERE id = p_employee_id;
  RETURN json_build_object('success', true, 'message', 'تم إعادة تنشيط الموظف بنجاح');
END;
$$;
