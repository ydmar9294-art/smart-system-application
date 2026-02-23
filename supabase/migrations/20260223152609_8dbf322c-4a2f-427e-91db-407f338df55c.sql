
CREATE OR REPLACE FUNCTION public.add_employee_rpc(p_name text, p_phone text, p_role text, p_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_license_key TEXT;
  v_max_employees INT;
  v_current_count INT;
BEGIN
  SELECT organization_id, license_key INTO v_org_id, v_license_key FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- Check employee limit
  IF v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key;
    SELECT COUNT(*) INTO v_current_count FROM profiles WHERE organization_id = v_org_id AND role = 'EMPLOYEE';
    v_current_count := v_current_count + (SELECT COUNT(*) FROM pending_employees WHERE organization_id = v_org_id AND is_used = false);
    IF v_current_count >= COALESCE(v_max_employees, 10) THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين';
    END IF;
  END IF;
  
  -- Generate unique activation code with EMP- prefix
  v_code := 'EMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
  VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());
  
  RETURN v_code;
END;
$function$;
