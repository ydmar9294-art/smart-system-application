-- ============================================
-- إعادة هيكلة دوال إدارة الموظفين
-- المالك يمتلك الآن جميع الصلاحيات (بدون مدير مبيعات)
-- ============================================

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
BEGIN
  SELECT organization_id, license_key, role
  INTO v_org_id, v_license_key, v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  -- المالك فقط يستطيع إضافة الموظفين، ويستطيع إضافة جميع الأنواع المسموحة
  IF v_caller_role = 'OWNER' THEN
    IF p_type NOT IN ('ACCOUNTANT', 'WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RAISE EXCEPTION 'نوع الموظف غير مسموح';
    END IF;
  ELSE
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظفين';
  END IF;

  -- LOCK license row to prevent race conditions
  SELECT dl.max_employees INTO v_max_employees
  FROM developer_licenses dl WHERE dl.organization_id = v_org_id
  FOR UPDATE;

  IF v_max_employees IS NULL AND v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key FOR UPDATE;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM profiles
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;

  v_active_count := v_active_count + (
    SELECT COUNT(*) FROM pending_employees
    WHERE organization_id = v_org_id AND is_used = false
  );

  IF v_active_count >= COALESCE(v_max_employees, 10) THEN
    RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين النشطين. يرجى التواصل مع المطور لزيادة الحد.';
  END IF;

  v_code := 'EMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
  VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());

  RETURN v_code;
END;
$function$;

-- ============================================
CREATE OR REPLACE FUNCTION public.deactivate_employee_rpc(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_target_org UUID;
  v_caller_role TEXT;
  v_target_type TEXT;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_caller_role
  FROM profiles WHERE id = auth.uid();

  SELECT organization_id, employee_type INTO v_target_org, v_target_type
  FROM profiles WHERE id = p_employee_id;

  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;

  IF v_caller_role = 'OWNER' THEN
    IF v_target_type NOT IN ('ACCOUNTANT', 'WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'نوع الموظف غير مسموح');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بإيقاف الموظفين');
  END IF;

  UPDATE profiles SET is_active = false WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم تعطيل الموظف بنجاح');
END;
$function$;

-- ============================================
CREATE OR REPLACE FUNCTION public.reactivate_employee_rpc(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_target_org UUID;
  v_caller_role TEXT;
  v_target_type TEXT;
  v_max_employees INT;
  v_active_count INT;
  v_license_key TEXT;
BEGIN
  SELECT organization_id, role, license_key INTO v_org_id, v_caller_role, v_license_key
  FROM profiles WHERE id = auth.uid();

  SELECT organization_id, employee_type INTO v_target_org, v_target_type
  FROM profiles WHERE id = p_employee_id;

  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;

  IF v_caller_role = 'OWNER' THEN
    IF v_target_type NOT IN ('ACCOUNTANT', 'WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'نوع الموظف غير مسموح');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بإعادة تفعيل الموظفين');
  END IF;

  -- Check employee limit before reactivation
  SELECT dl.max_employees INTO v_max_employees
  FROM developer_licenses dl WHERE dl.organization_id = v_org_id
  FOR UPDATE;

  IF v_max_employees IS NULL AND v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key FOR UPDATE;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM profiles
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;

  v_active_count := v_active_count + (
    SELECT COUNT(*) FROM pending_employees
    WHERE organization_id = v_org_id AND is_used = false
  );

  IF v_active_count >= COALESCE(v_max_employees, 10) THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم الوصول للحد الأقصى من الموظفين النشطين');
  END IF;

  UPDATE profiles SET is_active = true WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إعادة تفعيل الموظف بنجاح');
END;
$function$;