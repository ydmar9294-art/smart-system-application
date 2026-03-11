
-- Fix: Add employee limit check at activation time + row locking for race condition prevention

-- 1. activate_employee_oauth: ADD LIMIT CHECK before creating profile
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(p_user_id uuid, p_google_id text, p_email text, p_full_name text, p_activation_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending RECORD;
  v_employee_name TEXT;
  v_max_employees INT;
  v_active_count INT;
BEGIN
  -- Find and LOCK the pending employee row to prevent race conditions
  SELECT * INTO v_pending FROM pending_employees 
  WHERE activation_code = p_activation_code AND is_used = false
  FOR UPDATE SKIP LOCKED;
  
  IF v_pending IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'كود التفعيل غير صالح أو مستخدم');
  END IF;
  
  -- ========== CRITICAL: RE-CHECK EMPLOYEE LIMIT AT ACTIVATION TIME ==========
  SELECT dl.max_employees INTO v_max_employees 
  FROM developer_licenses dl WHERE dl.organization_id = v_pending.organization_id
  FOR UPDATE;
  
  -- Count current active employees
  SELECT COUNT(*) INTO v_active_count 
  FROM profiles 
  WHERE organization_id = v_pending.organization_id AND role = 'EMPLOYEE' AND is_active = true;
  
  IF v_active_count >= COALESCE(v_max_employees, 10) THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم الوصول للحد الأقصى من الموظفين النشطين. لا يمكن تفعيل الحساب حالياً.');
  END IF;
  
  -- USE THE MANUALLY REGISTERED NAME, not the Google account name
  v_employee_name := v_pending.name;
  
  -- Create/update profile with the registered name
  INSERT INTO profiles (id, full_name, email, phone, role, employee_type, organization_id, license_key)
  VALUES (
    p_user_id, v_employee_name, p_email, v_pending.phone,
    v_pending.role, v_pending.employee_type, v_pending.organization_id,
    (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET 
    full_name = v_employee_name, email = p_email,
    role = v_pending.role, employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    license_key = (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1);
  
  -- Mark code as used
  UPDATE pending_employees SET is_used = true, activated_at = now(), activated_by = p_user_id
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل حساب الموظف بنجاح');
END;
$function$;

-- 2. reactivate_employee_rpc: Add FOR UPDATE locking to prevent race conditions
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
  v_caller_type TEXT;
  v_target_type TEXT;
  v_max_employees INT;
  v_active_count INT;
BEGIN
  SELECT organization_id, role, employee_type INTO v_org_id, v_caller_role, v_caller_type 
  FROM profiles WHERE id = auth.uid();
  
  SELECT organization_id, employee_type INTO v_target_org, v_target_type 
  FROM profiles WHERE id = p_employee_id;
  
  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;
  
  IF v_caller_role = 'OWNER' THEN
    IF v_target_type NOT IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'المالك يمكنه فقط إعادة تنشيط مدير المبيعات أو المحاسب');
    END IF;
  ELSIF v_caller_role = 'EMPLOYEE' AND v_caller_type = 'SALES_MANAGER' THEN
    IF v_target_type NOT IN ('WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'مدير المبيعات يمكنه فقط إعادة تنشيط أمين المستودع أو الموزع الميداني');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بإعادة تنشيط الموظفين');
  END IF;
  
  -- LOCK license row to prevent race conditions
  SELECT dl.max_employees INTO v_max_employees 
  FROM developer_licenses dl WHERE dl.organization_id = v_org_id
  FOR UPDATE;
  
  SELECT COUNT(*) INTO v_active_count 
  FROM profiles 
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;
  
  IF v_active_count >= COALESCE(v_max_employees, 10) THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم الوصول للحد الأقصى من الموظفين النشطين. يرجى التواصل مع المطور لزيادة الحد.');
  END IF;
  
  UPDATE profiles SET is_active = true WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إعادة تنشيط الموظف بنجاح');
END;
$function$;

-- 3. add_employee_rpc: Add FOR UPDATE locking
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
  SELECT organization_id, license_key, role, employee_type 
  INTO v_org_id, v_license_key, v_caller_role, v_caller_type 
  FROM profiles WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- ROLE CREATION RULES
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
  
  -- LOCK license row to prevent race conditions
  SELECT dl.max_employees INTO v_max_employees 
  FROM developer_licenses dl WHERE dl.organization_id = v_org_id
  FOR UPDATE;
  
  -- Fallback if no license found by org
  IF v_max_employees IS NULL AND v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key FOR UPDATE;
  END IF;
  
  -- Count active employees + unused pending codes
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
