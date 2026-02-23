
-- =============================================
-- 1. UPDATE add_employee_rpc: Role creation rules + ACTIVE-only limit
-- =============================================
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
  -- Owner can ONLY create: SALES_MANAGER, ACCOUNTANT
  IF v_caller_role = 'OWNER' THEN
    IF p_type NOT IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
      RAISE EXCEPTION 'المالك يمكنه فقط إنشاء مدير مبيعات أو محاسب';
    END IF;
  -- Sales Manager can ONLY create: WAREHOUSE_KEEPER, FIELD_AGENT
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
    -- Fallback: check org's license
    SELECT dl.max_employees INTO v_max_employees 
    FROM developer_licenses dl WHERE dl.organization_id = v_org_id LIMIT 1;
  END IF;
  
  -- Count ONLY ACTIVE employees (is_active = true, role = 'EMPLOYEE')
  SELECT COUNT(*) INTO v_active_count 
  FROM profiles 
  WHERE organization_id = v_org_id AND role = 'EMPLOYEE' AND is_active = true;
  
  -- Also count unused pending employees (they will become active)
  v_active_count := v_active_count + (
    SELECT COUNT(*) FROM pending_employees 
    WHERE organization_id = v_org_id AND is_used = false
  );
  
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

-- =============================================
-- 2. UPDATE deactivate_employee_rpc: Role-based deactivation permissions
-- =============================================
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
  v_caller_type TEXT;
  v_target_type TEXT;
BEGIN
  -- Get caller info
  SELECT organization_id, role, employee_type INTO v_org_id, v_caller_role, v_caller_type 
  FROM profiles WHERE id = auth.uid();
  
  -- Get target info
  SELECT organization_id, employee_type INTO v_target_org, v_target_type 
  FROM profiles WHERE id = p_employee_id;
  
  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;
  
  -- ========== DEACTIVATION PERMISSION RULES ==========
  -- Owner can deactivate: SALES_MANAGER, ACCOUNTANT
  IF v_caller_role = 'OWNER' THEN
    IF v_target_type NOT IN ('SALES_MANAGER', 'ACCOUNTANT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'المالك يمكنه فقط إيقاف مدير المبيعات أو المحاسب');
    END IF;
  -- Sales Manager can deactivate: WAREHOUSE_KEEPER, FIELD_AGENT
  ELSIF v_caller_role = 'EMPLOYEE' AND v_caller_type = 'SALES_MANAGER' THEN
    IF v_target_type NOT IN ('WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RETURN jsonb_build_object('success', false, 'message', 'مدير المبيعات يمكنه فقط إيقاف أمين المستودع أو الموزع الميداني');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بإيقاف الموظفين');
  END IF;
  
  UPDATE profiles SET is_active = false WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم تعطيل الموظف بنجاح');
END;
$function$;

-- =============================================
-- 3. UPDATE reactivate_employee_rpc: Check ACTIVE limit before reactivating
-- =============================================
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
  -- Get caller info
  SELECT organization_id, role, employee_type INTO v_org_id, v_caller_role, v_caller_type 
  FROM profiles WHERE id = auth.uid();
  
  -- Get target info
  SELECT organization_id, employee_type INTO v_target_org, v_target_type 
  FROM profiles WHERE id = p_employee_id;
  
  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;
  
  -- ========== REACTIVATION PERMISSION RULES ==========
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
  
  -- ========== ACTIVE EMPLOYEE LIMIT CHECK (ATOMIC) ==========
  SELECT dl.max_employees INTO v_max_employees 
  FROM developer_licenses dl WHERE dl.organization_id = v_org_id LIMIT 1;
  
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

-- =============================================
-- 4. UPDATE get_organization_stats_rpc: Count ACTIVE employees only
-- =============================================
CREATE OR REPLACE FUNCTION public.get_organization_stats_rpc()
 RETURNS TABLE(org_id uuid, org_name text, license_id uuid, license_status text, license_type text, max_employees integer, expiry_date timestamp with time zone, employee_count bigint, total_users bigint, pending_employees bigint, total_sales bigint, total_products bigint, total_customers bigint, total_deliveries bigint, total_purchases bigint, total_revenue numeric, total_collections numeric, total_records bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id AS org_id,
    o.name AS org_name,
    dl.id AS license_id,
    dl.status AS license_status,
    dl.type AS license_type,
    dl.max_employees,
    dl."expiryDate" AS expiry_date,
    -- ACTIVE employees only (is_active = true)
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.role = 'EMPLOYEE' AND p.is_active = true)::BIGINT AS employee_count,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id)::BIGINT AS total_users,
    (SELECT COUNT(*) FROM pending_employees pe WHERE pe.organization_id = o.id AND pe.is_used = false)::BIGINT AS pending_employees,
    (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id)::BIGINT AS total_sales,
    (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.is_deleted = false)::BIGINT AS total_products,
    (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)::BIGINT AS total_customers,
    (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id)::BIGINT AS total_deliveries,
    (SELECT COUNT(*) FROM purchases pu WHERE pu.organization_id = o.id)::BIGINT AS total_purchases,
    COALESCE((SELECT SUM(s.grand_total) FROM sales s WHERE s.organization_id = o.id AND s.is_voided = false), 0) AS total_revenue,
    COALESCE((SELECT SUM(col.amount) FROM collections col WHERE col.organization_id = o.id AND col.is_reversed = false), 0) AS total_collections,
    (
      (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id) +
      (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id) +
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)
    )::BIGINT AS total_records
  FROM organizations o
  LEFT JOIN developer_licenses dl ON dl.organization_id = o.id
  ORDER BY o.name;
END;
$function$;
