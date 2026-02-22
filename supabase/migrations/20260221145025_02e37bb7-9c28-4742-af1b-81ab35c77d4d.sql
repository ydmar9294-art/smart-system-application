
-- Fix get_organization_stats_rpc to count only ACTIVE employees
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
      (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.role = 'EMPLOYEE' AND p.is_active = true) AS employee_count,
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

-- Fix add_employee_rpc to enforce limit based on ACTIVE employees only
CREATE OR REPLACE FUNCTION public.add_employee_rpc(
    p_name TEXT,
    p_phone TEXT,
    p_role public.user_role,
    p_type public.employee_type
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

    -- Default limit if no license found
    IF v_max_employees IS NULL THEN
      v_max_employees := 10;
    END IF;

    -- Check license status
    IF v_license_status IS NOT NULL AND v_license_status = 'SUSPENDED' THEN
      RAISE EXCEPTION 'الترخيص موقوف - لا يمكن إضافة موظفين جدد';
    END IF;

    -- Count ACTIVE employees only + unused pending employees
    v_current_count := public.get_active_employee_count(v_org_id);

    -- Also count unused pending employees
    v_current_count := v_current_count + (
      SELECT COUNT(*) FROM public.pending_employees pe
      WHERE pe.organization_id = v_org_id AND pe.is_used = false
    );

    IF v_current_count >= v_max_employees THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين النشطين (% / %). يمكنك تعطيل موظف حالي أو التواصل مع المطور لزيادة العدد.', v_current_count, v_max_employees;
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
