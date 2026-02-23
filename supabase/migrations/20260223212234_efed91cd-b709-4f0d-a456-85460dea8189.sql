
-- Fix add_employee_rpc: count ONLY active employees, not pending unused codes
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
  v_active_count INT;
  v_caller_role TEXT;
  v_caller_type TEXT;
BEGIN
  -- Get caller info
  SELECT organization_id, license_key, role, employee_type 
  INTO v_org_id, v_license_key, v_caller_role, v_caller_type 
  FROM profiles WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- ========== ROLE CREATION RULES (STRICT) ==========
  IF v_caller_role = 'OWNER' THEN
    IF p_type NOT IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
      RAISE EXCEPTION 'المالك يمكنه فقط إنشاء مدير مبيعات أو محاسب';
    END IF;
  ELSIF v_caller_role = 'EMPLOYEE' AND v_caller_type = 'SALES_MANAGER' THEN
    IF p_type NOT IN ('WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RAISE EXCEPTION 'مدير المبيعات يمكنه فقط إنشاء أمين مستودع أو موزع ميداني';
    END IF;
  ELSE
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظفين';
  END IF;
  
  -- ========== ACTIVE EMPLOYEE LIMIT CHECK ==========
  -- Get max from license
  IF v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key;
  ELSE
    SELECT dl.max_employees INTO v_max_employees 
    FROM developer_licenses dl WHERE dl.organization_id = v_org_id LIMIT 1;
  END IF;
  
  -- Count ONLY active employees (is_active = true, role = 'EMPLOYEE')
  -- Do NOT count pending/unused codes - they are not active employees
  SELECT COUNT(*) INTO v_active_count 
  FROM profiles 
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;
  
  IF v_active_count >= COALESCE(v_max_employees, 10) THEN
    RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين النشطين. يرجى التواصل مع المطور لزيادة الحد.';
  END IF;
  
  -- Generate unique activation code with EMP- prefix
  v_code := 'EMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
  VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());
  
  RETURN v_code;
END;
$function$;

-- Fix update_license_max_employees_rpc: count ONLY active employees
CREATE OR REPLACE FUNCTION public.update_license_max_employees_rpc(p_license_id uuid, p_max_employees integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_current INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  SELECT organization_id INTO v_org_id FROM developer_licenses WHERE id = p_license_id;
  
  -- Count ONLY active employees, not total
  SELECT COUNT(*) INTO v_current FROM profiles 
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;
  
  UPDATE developer_licenses SET max_employees = p_max_employees WHERE id = p_license_id;
  
  RETURN jsonb_build_object('current_employees', v_current, 'exceeds_limit', v_current > p_max_employees);
END;
$function$;
