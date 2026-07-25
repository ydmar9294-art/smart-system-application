CREATE INDEX IF NOT EXISTS idx_pending_employees_org_field_unused
ON public.pending_employees (organization_id, employee_type)
WHERE is_used = false;

CREATE INDEX IF NOT EXISTS idx_pending_employees_org_created_desc
ON public.pending_employees (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_org_active_field_agents
ON public.profiles (organization_id, employee_type)
WHERE role = 'EMPLOYEE' AND employee_type = 'FIELD_AGENT' AND is_active = true;

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
  v_max_distributors INT;
  v_active_distributors INT := 0;
  v_pending_distributors INT := 0;
  v_caller_role TEXT;
  v_try INT := 0;
BEGIN
  SELECT organization_id, license_key, role
  INTO v_org_id, v_license_key, v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة';
  END IF;

  IF v_caller_role <> 'OWNER' THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظفين';
  END IF;

  IF p_role <> 'EMPLOYEE' THEN
    RAISE EXCEPTION 'دور الموظف غير مسموح';
  END IF;

  IF p_type NOT IN ('ACCOUNTANT', 'FIELD_AGENT') THEN
    RAISE EXCEPTION 'نوع الموظف غير مسموح';
  END IF;

  -- الحد يطبَّق فقط على الموزعين الميدانيين، مع قفل صف الترخيص لمنع تجاوز الحد عند الطلبات المتزامنة.
  IF p_type = 'FIELD_AGENT' THEN
    SELECT dl.max_employees
    INTO v_max_distributors
    FROM public.developer_licenses dl
    WHERE dl.organization_id = v_org_id
    FOR UPDATE;

    IF v_max_distributors IS NULL AND v_license_key IS NOT NULL THEN
      SELECT dl.max_employees
      INTO v_max_distributors
      FROM public.developer_licenses dl
      WHERE dl."licenseKey" = v_license_key
      FOR UPDATE;
    END IF;

    SELECT COUNT(*)
    INTO v_active_distributors
    FROM public.profiles
    WHERE organization_id = v_org_id
      AND role = 'EMPLOYEE'
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true;

    SELECT COUNT(*)
    INTO v_pending_distributors
    FROM public.pending_employees
    WHERE organization_id = v_org_id
      AND employee_type = 'FIELD_AGENT'
      AND is_used = false;

    IF (v_active_distributors + v_pending_distributors) >= COALESCE(v_max_distributors, 1) THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموزعين النشطين (%). يرجى التواصل مع المطور لزيادة الحد.', COALESCE(v_max_distributors, 1);
    END IF;
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := 'EMP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    BEGIN
      INSERT INTO public.pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
      VALUES (v_org_id, trim(p_name), nullif(trim(COALESCE(p_phone, '')), ''), 'EMPLOYEE', p_type, v_code, auth.uid());

      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 3 THEN
        RAISE EXCEPTION 'تعذر توليد كود فريد، حاول مرة أخرى';
      END IF;
    END;
  END LOOP;
END;
$function$;