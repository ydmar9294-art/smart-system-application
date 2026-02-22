
-- =============================================
-- P1: Add max_employees & owner_phone to licenses
-- P2: Secure RPCs with audit logging for license operations
-- =============================================

-- 1. Add new columns to developer_licenses
ALTER TABLE public.developer_licenses
  ADD COLUMN IF NOT EXISTS max_employees INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT;

-- 2. Update issue_license_rpc to accept max_employees and owner_phone
CREATE OR REPLACE FUNCTION public.issue_license_rpc(
  p_org_name TEXT,
  p_type license_type,
  p_days INTEGER DEFAULT 30,
  p_max_employees INTEGER DEFAULT 10,
  p_owner_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_id UUID;
  v_key TEXT;
  v_expiry TIMESTAMPTZ;
BEGIN
  -- Only developers can issue licenses
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized: Only developers can issue licenses';
  END IF;

  -- Validate inputs
  IF p_org_name IS NULL OR length(trim(p_org_name)) < 2 THEN
    RAISE EXCEPTION 'اسم المنشأة يجب أن يكون حرفين على الأقل';
  END IF;

  IF p_max_employees < 1 OR p_max_employees > 500 THEN
    RAISE EXCEPTION 'عدد الموظفين المسموح يجب أن يكون بين 1 و 500';
  END IF;

  IF p_type = 'TRIAL' AND (p_days < 1 OR p_days > 365) THEN
    RAISE EXCEPTION 'عدد أيام التجربة يجب أن يكون بين 1 و 365';
  END IF;

  -- Generate key
  v_key := public.generate_license_key();

  IF p_type = 'TRIAL' THEN
    v_expiry := now() + (p_days || ' days')::interval;
  ELSE
    v_expiry := NULL;
  END IF;

  INSERT INTO public.developer_licenses ("licenseKey", "orgName", type, status, "expiryDate", days_valid, max_employees, owner_phone)
  VALUES (v_key, trim(p_org_name), p_type, 'READY', v_expiry, p_days, p_max_employees, p_owner_phone)
  RETURNING id INTO v_license_id;

  -- Audit log
  PERFORM public.log_audit_event(
    p_user_id := auth.uid(),
    p_action := 'LICENSE_ISSUED',
    p_resource_type := 'license',
    p_resource_id := v_license_id::text,
    p_severity := 'info',
    p_details := jsonb_build_object(
      'org_name', trim(p_org_name),
      'type', p_type,
      'max_employees', p_max_employees,
      'days', p_days
    )
  );

  RETURN v_license_id;
END;
$$;

-- 3. Enforce employee limit inside add_employee_rpc
CREATE OR REPLACE FUNCTION public.add_employee_rpc(
  p_name TEXT,
  p_phone TEXT,
  p_role user_role,
  p_type employee_type
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_code TEXT;
    v_creator_role user_role;
    v_creator_employee_type employee_type;
    v_max_employees INTEGER;
    v_current_count INTEGER;
    v_license_status license_status;
BEGIN
    -- Get creator's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'لا توجد منشأة مرتبطة بحسابك';
    END IF;
    
    -- Get creator's role and employee type
    SELECT role, employee_type INTO v_creator_role, v_creator_employee_type
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Validate hierarchy
    IF NOT public.can_create_employee_type(v_creator_role, v_creator_employee_type, p_type) THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك إنشاء موظفين من نوع %', p_type;
    END IF;

    -- Check employee limit from license
    SELECT dl.max_employees, dl.status INTO v_max_employees, v_license_status
    FROM public.developer_licenses dl
    WHERE dl."ownerId" = (
      SELECT ou.user_id FROM public.organization_users ou 
      WHERE ou.organization_id = v_org_id AND ou.role = 'OWNER'
      LIMIT 1
    )
    ORDER BY dl."issuedAt" DESC
    LIMIT 1;

    -- If no license found, check by org name match
    IF v_max_employees IS NULL THEN
      SELECT dl.max_employees, dl.status INTO v_max_employees, v_license_status
      FROM public.developer_licenses dl
      JOIN public.organizations o ON o.name = dl."orgName"
      WHERE o.id = v_org_id AND dl.status = 'ACTIVE'
      ORDER BY dl."issuedAt" DESC
      LIMIT 1;
    END IF;

    -- Default limit if no license found (backward compatibility)
    IF v_max_employees IS NULL THEN
      v_max_employees := 10;
    END IF;

    -- Check license status
    IF v_license_status IS NOT NULL AND v_license_status = 'SUSPENDED' THEN
      RAISE EXCEPTION 'الترخيص موقوف - لا يمكن إضافة موظفين جدد';
    END IF;

    -- Count current employees (active profiles + unused pending)
    SELECT COUNT(*) INTO v_current_count
    FROM public.profiles p
    WHERE p.organization_id = v_org_id
      AND p.role = 'EMPLOYEE';

    -- Also count unused pending employees
    v_current_count := v_current_count + (
      SELECT COUNT(*) FROM public.pending_employees pe
      WHERE pe.organization_id = v_org_id AND pe.is_used = false
    );

    IF v_current_count >= v_max_employees THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين (% / %). تواصل مع المطور لزيادة العدد.', v_current_count, v_max_employees;
    END IF;

    -- Input validation
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
      RAISE EXCEPTION 'اسم الموظف يجب أن يكون حرفين على الأقل';
    END IF;
    
    -- Generate activation code
    v_code := 'EMP-' || public.generate_license_key();
    
    -- Store pending employee
    INSERT INTO public.pending_employees (
        organization_id, name, phone, role, employee_type, activation_code, created_by
    ) VALUES (
        v_org_id, trim(p_name), p_phone, p_role, p_type, v_code, auth.uid()
    );
    
    RETURN v_code;
END;
$$;

-- 4. Secure RPC for updating license status (replaces direct update)
CREATE OR REPLACE FUNCTION public.update_license_status_rpc(
  p_license_id UUID,
  p_status license_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status license_status;
  v_org_name TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT status, "orgName" INTO v_old_status, v_org_name
  FROM public.developer_licenses WHERE id = p_license_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'الترخيص غير موجود';
  END IF;

  UPDATE public.developer_licenses SET status = p_status WHERE id = p_license_id;

  PERFORM public.log_audit_event(
    p_user_id := auth.uid(),
    p_action := 'LICENSE_STATUS_CHANGED',
    p_resource_type := 'license',
    p_resource_id := p_license_id::text,
    p_severity := 'warning',
    p_details := jsonb_build_object(
      'org_name', v_org_name,
      'old_status', v_old_status,
      'new_status', p_status
    )
  );
END;
$$;

-- 5. Secure RPC for making license permanent
CREATE OR REPLACE FUNCTION public.make_license_permanent_rpc(
  p_license_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_type license_type;
  v_org_name TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT type, "orgName" INTO v_old_type, v_org_name
  FROM public.developer_licenses WHERE id = p_license_id;

  IF v_old_type IS NULL THEN
    RAISE EXCEPTION 'الترخيص غير موجود';
  END IF;

  IF v_old_type = 'PERMANENT' THEN
    RAISE EXCEPTION 'الترخيص دائم بالفعل';
  END IF;

  UPDATE public.developer_licenses 
  SET type = 'PERMANENT', "expiryDate" = NULL 
  WHERE id = p_license_id;

  PERFORM public.log_audit_event(
    p_user_id := auth.uid(),
    p_action := 'LICENSE_MADE_PERMANENT',
    p_resource_type := 'license',
    p_resource_id := p_license_id::text,
    p_severity := 'warning',
    p_details := jsonb_build_object('org_name', v_org_name)
  );
END;
$$;

-- 6. RPC to update max_employees (editable by developer anytime)
CREATE OR REPLACE FUNCTION public.update_license_max_employees_rpc(
  p_license_id UUID,
  p_max_employees INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name TEXT;
  v_old_max INTEGER;
  v_current_count INTEGER;
  v_org_id UUID;
  v_owner_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_max_employees < 1 OR p_max_employees > 500 THEN
    RAISE EXCEPTION 'عدد الموظفين يجب أن يكون بين 1 و 500';
  END IF;

  SELECT "orgName", max_employees, "ownerId" INTO v_org_name, v_old_max, v_owner_id
  FROM public.developer_licenses WHERE id = p_license_id;

  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'الترخيص غير موجود';
  END IF;

  -- Get current employee count for warning
  v_current_count := 0;
  IF v_owner_id IS NOT NULL THEN
    v_org_id := public.get_user_organization_id(v_owner_id);
    IF v_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current_count
      FROM public.profiles WHERE organization_id = v_org_id AND role = 'EMPLOYEE';
      
      v_current_count := v_current_count + (
        SELECT COUNT(*) FROM public.pending_employees
        WHERE organization_id = v_org_id AND is_used = false
      );
    END IF;
  END IF;

  UPDATE public.developer_licenses SET max_employees = p_max_employees WHERE id = p_license_id;

  PERFORM public.log_audit_event(
    p_user_id := auth.uid(),
    p_action := 'LICENSE_EMPLOYEES_UPDATED',
    p_resource_type := 'license',
    p_resource_id := p_license_id::text,
    p_severity := CASE WHEN p_max_employees < v_current_count THEN 'warning' ELSE 'info' END,
    p_details := jsonb_build_object(
      'org_name', v_org_name,
      'old_max', v_old_max,
      'new_max', p_max_employees,
      'current_count', v_current_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'current_employees', v_current_count,
    'exceeds_limit', v_current_count > p_max_employees
  );
END;
$$;

-- 7. RPC to get organization statistics for developer dashboard
CREATE OR REPLACE FUNCTION public.get_organization_stats_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_row RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_row IN
    SELECT 
      o.id AS org_id,
      o.name AS org_name,
      dl.id AS license_id,
      dl.status AS license_status,
      dl.type AS license_type,
      dl.max_employees,
      dl."expiryDate" AS expiry_date,
      (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.role = 'EMPLOYEE') AS employee_count,
      (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id) AS total_users,
      (SELECT COUNT(*) FROM pending_employees pe WHERE pe.organization_id = o.id AND pe.is_used = false) AS pending_employees,
      (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id) AS total_sales,
      (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.is_deleted = false) AS total_products,
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id) AS total_customers,
      (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id) AS total_deliveries,
      (SELECT COUNT(*) FROM purchases pu WHERE pu.organization_id = o.id) AS total_purchases,
      (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.organization_id = o.id AND s.is_voided = false) AS total_revenue,
      (SELECT COUNT(*) FROM collections col WHERE col.organization_id = o.id) AS total_collections
    FROM organizations o
    LEFT JOIN developer_licenses dl ON dl."orgName" = o.name AND dl.status = 'ACTIVE'
  LOOP
    v_result := v_result || jsonb_build_object(
      'org_id', v_row.org_id,
      'org_name', v_row.org_name,
      'license_id', v_row.license_id,
      'license_status', v_row.license_status,
      'license_type', v_row.license_type,
      'max_employees', COALESCE(v_row.max_employees, 10),
      'expiry_date', v_row.expiry_date,
      'employee_count', v_row.employee_count,
      'total_users', v_row.total_users,
      'pending_employees', v_row.pending_employees,
      'total_sales', v_row.total_sales,
      'total_products', v_row.total_products,
      'total_customers', v_row.total_customers,
      'total_deliveries', v_row.total_deliveries,
      'total_purchases', v_row.total_purchases,
      'total_revenue', v_row.total_revenue,
      'total_collections', v_row.total_collections,
      'total_records', v_row.total_sales + v_row.total_products + v_row.total_customers + v_row.total_deliveries + v_row.total_purchases
    );
  END LOOP;

  RETURN v_result;
END;
$$;
