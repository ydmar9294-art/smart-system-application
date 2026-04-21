
-- ============================================================
-- إعادة تصميم الحد الأقصى ليعتمد على الموزعين (FIELD_AGENT) فقط
-- ============================================================
-- المنطق الجديد:
--   * max_employees = الحد الأقصى لعدد الموزعين الميدانيين النشطين فقط
--   * المحاسبون / أمناء المستودعات / أي أدوار أخرى: بدون أي حد
--   * عند إنشاء التجربة: max_employees = p_distributors_count بالضبط (بلا أي إضافة)
--   * عند الإصدار من المطور: max_employees = p_max_employees بالضبط
-- ============================================================

-- 1) add_employee_rpc: تطبيق الحد فقط على FIELD_AGENT
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
  v_active_distributors INT;
  v_caller_role TEXT;
BEGIN
  SELECT organization_id, license_key, role
  INTO v_org_id, v_license_key, v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  IF v_caller_role = 'OWNER' THEN
    IF p_type NOT IN ('ACCOUNTANT', 'WAREHOUSE_KEEPER', 'FIELD_AGENT') THEN
      RAISE EXCEPTION 'نوع الموظف غير مسموح';
    END IF;
  ELSE
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظفين';
  END IF;

  -- الحد يطبَّق فقط على الموزعين الميدانيين (FIELD_AGENT)
  IF p_type = 'FIELD_AGENT' THEN
    SELECT dl.max_employees INTO v_max_distributors
    FROM developer_licenses dl WHERE dl.organization_id = v_org_id
    FOR UPDATE;

    IF v_max_distributors IS NULL AND v_license_key IS NOT NULL THEN
      SELECT max_employees INTO v_max_distributors
      FROM developer_licenses WHERE "licenseKey" = v_license_key FOR UPDATE;
    END IF;

    -- عدّ الموزعين النشطين الحاليين + الموزعين قيد التفعيل
    SELECT COUNT(*) INTO v_active_distributors
    FROM profiles
    WHERE organization_id = v_org_id
      AND role = 'EMPLOYEE'
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true;

    v_active_distributors := v_active_distributors + (
      SELECT COUNT(*) FROM pending_employees
      WHERE organization_id = v_org_id
        AND employee_type = 'FIELD_AGENT'
        AND is_used = false
    );

    IF v_active_distributors >= COALESCE(v_max_distributors, 1) THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموزعين النشطين (%). يرجى التواصل مع المطور لزيادة الحد.', COALESCE(v_max_distributors, 1);
    END IF;
  END IF;

  v_code := 'EMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
  VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());

  RETURN v_code;
END;
$function$;


-- 2) activate_employee_oauth: فحص الحد فقط للموزعين عند التفعيل
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(p_user_id uuid, p_google_id text, p_email text, p_full_name text, p_activation_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending RECORD;
  v_employee_name TEXT;
  v_max_distributors INT;
  v_active_distributors INT;
BEGIN
  SELECT * INTO v_pending FROM pending_employees
  WHERE activation_code = p_activation_code AND is_used = false
  FOR UPDATE SKIP LOCKED;

  IF v_pending IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'كود التفعيل غير صالح أو مستخدم');
  END IF;

  -- إعادة فحص الحد عند التفعيل (للموزعين فقط)
  IF v_pending.employee_type = 'FIELD_AGENT' THEN
    SELECT dl.max_employees INTO v_max_distributors
    FROM developer_licenses dl WHERE dl.organization_id = v_pending.organization_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_active_distributors
    FROM profiles
    WHERE organization_id = v_pending.organization_id
      AND role = 'EMPLOYEE'
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true;

    IF v_active_distributors >= COALESCE(v_max_distributors, 1) THEN
      RETURN jsonb_build_object('success', false, 'message', 'تم الوصول للحد الأقصى من الموزعين النشطين. لا يمكن تفعيل الحساب حالياً.');
    END IF;
  END IF;

  v_employee_name := v_pending.name;

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

  UPDATE pending_employees SET is_used = true, activated_at = now(), activated_by = p_user_id
  WHERE id = v_pending.id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل حساب الموظف بنجاح');
END;
$function$;


-- 3) reactivate_employee_rpc: فحص الحد فقط للموزعين عند إعادة التفعيل
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
  v_max_distributors INT;
  v_active_distributors INT;
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

  -- فحص الحد فقط للموزعين الميدانيين
  IF v_target_type = 'FIELD_AGENT' THEN
    SELECT dl.max_employees INTO v_max_distributors
    FROM developer_licenses dl WHERE dl.organization_id = v_org_id
    FOR UPDATE;

    IF v_max_distributors IS NULL AND v_license_key IS NOT NULL THEN
      SELECT max_employees INTO v_max_distributors
      FROM developer_licenses WHERE "licenseKey" = v_license_key FOR UPDATE;
    END IF;

    SELECT COUNT(*) INTO v_active_distributors
    FROM profiles
    WHERE organization_id = v_org_id
      AND role = 'EMPLOYEE'
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true;

    IF v_active_distributors >= COALESCE(v_max_distributors, 1) THEN
      RETURN jsonb_build_object('success', false, 'message', 'تم الوصول للحد الأقصى من الموزعين النشطين');
    END IF;
  END IF;

  UPDATE profiles SET is_active = true WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إعادة تفعيل الموظف بنجاح');
END;
$function$;


-- 4) create_self_service_trial: max_employees = distributors_count بالضبط (بلا إضافة)
DROP FUNCTION IF EXISTS public.create_self_service_trial(text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.create_self_service_trial(
  p_full_name text,
  p_org_name text,
  p_distributors_count integer,
  p_phone text,
  p_whatsapp text,
  p_base_currency_code text DEFAULT NULL,
  p_base_currency_name text DEFAULT NULL,
  p_base_currency_symbol text DEFAULT NULL,
  p_secondary_currency_code text DEFAULT NULL,
  p_secondary_currency_name text DEFAULT NULL,
  p_secondary_currency_symbol text DEFAULT NULL,
  p_exchange_rate numeric DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_license_id uuid;
  v_license_key text;
  v_existing_role text;
  v_existing_org uuid;
  v_max_employees integer;
  v_days integer := 15;
  v_base_code text;
  v_sec_code text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED', 'message', 'يجب تسجيل الدخول أولاً');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME', 'message', 'الاسم الكامل مطلوب (حرفان على الأقل)');
  END IF;
  IF p_org_name IS NULL OR length(trim(p_org_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ORG', 'message', 'اسم الشركة مطلوب (حرفان على الأقل)');
  END IF;
  IF p_distributors_count IS NULL OR p_distributors_count < 1 OR p_distributors_count > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_COUNT', 'message', 'عدد الموزعين يجب أن يكون بين 1 و 500');
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE', 'message', 'رقم الهاتف غير صحيح');
  END IF;
  IF p_whatsapp IS NULL OR length(trim(p_whatsapp)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_WHATSAPP', 'message', 'رقم الواتساب غير صحيح');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT role, organization_id INTO v_existing_role, v_existing_org
  FROM public.profiles WHERE id = v_uid;

  IF v_existing_org IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_MEMBER',
      'message', 'حسابك مرتبط بشركة فعلاً. لا يمكن إنشاء حساب تجريبي جديد');
  END IF;

  -- ============================================================
  -- التغيير الجذري: max_employees = عدد الموزعين بالضبط
  -- ============================================================
  v_max_employees := p_distributors_count;

  INSERT INTO public.organizations(name)
  VALUES (trim(p_org_name))
  RETURNING id INTO v_org_id;

  v_license_key := 'TRIAL-' || to_char(now(), 'YYYYMMDD') || '-' ||
                   upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.developer_licenses(
    "licenseKey", "orgName", type, status, "ownerId",
    "issuedAt", "expiryDate", days_valid,
    max_employees, organization_id, owner_phone,
    owner_full_name, distributors_count, whatsapp_number, is_self_service_trial
  )
  VALUES (
    v_license_key, trim(p_org_name), 'TRIAL', 'ACTIVE', v_uid,
    now(), now() + (v_days || ' days')::interval, v_days,
    v_max_employees, v_org_id, trim(p_phone),
    trim(p_full_name), p_distributors_count, trim(p_whatsapp), true
  )
  RETURNING id INTO v_license_id;

  INSERT INTO public.profiles(id, email, full_name, role, organization_id, license_key, phone, is_active)
  VALUES (v_uid, v_email, trim(p_full_name), 'OWNER', v_org_id, v_license_key, trim(p_phone), true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'OWNER',
    organization_id = EXCLUDED.organization_id,
    license_key = EXCLUDED.license_key,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    is_active = true,
    updated_at = now();

  IF p_base_currency_code IS NOT NULL AND length(trim(p_base_currency_code)) > 0 THEN
    v_base_code := upper(trim(p_base_currency_code));

    UPDATE public.org_currencies
       SET is_base = false
     WHERE organization_id = v_org_id
       AND is_base = true
       AND currency_code <> v_base_code;

    INSERT INTO public.org_currencies(
      organization_id, currency_code, currency_name_ar, symbol, is_base, is_active
    )
    VALUES (
      v_org_id, v_base_code,
      COALESCE(NULLIF(trim(p_base_currency_name), ''), v_base_code),
      NULLIF(trim(p_base_currency_symbol), ''),
      true, true
    )
    ON CONFLICT (organization_id, currency_code) DO UPDATE SET
      currency_name_ar = EXCLUDED.currency_name_ar,
      symbol = COALESCE(EXCLUDED.symbol, public.org_currencies.symbol),
      is_base = true, is_active = true, updated_at = now();

    IF p_secondary_currency_code IS NOT NULL
       AND length(trim(p_secondary_currency_code)) > 0
       AND upper(trim(p_secondary_currency_code)) <> v_base_code THEN

      v_sec_code := upper(trim(p_secondary_currency_code));

      INSERT INTO public.org_currencies(
        organization_id, currency_code, currency_name_ar, symbol, is_base, is_active
      )
      VALUES (
        v_org_id, v_sec_code,
        COALESCE(NULLIF(trim(p_secondary_currency_name), ''), v_sec_code),
        NULLIF(trim(p_secondary_currency_symbol), ''),
        false, true
      )
      ON CONFLICT (organization_id, currency_code) DO UPDATE SET
        currency_name_ar = EXCLUDED.currency_name_ar,
        symbol = COALESCE(EXCLUDED.symbol, public.org_currencies.symbol),
        is_active = true, updated_at = now();

      IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
        INSERT INTO public.exchange_rates(
          organization_id, from_currency, to_currency, rate, created_by, created_by_name, notes
        )
        VALUES (
          v_org_id, v_base_code, v_sec_code, p_exchange_rate,
          v_uid, trim(p_full_name), 'سعر صرف افتتاحي عند إنشاء المنشأة'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'license_id', v_license_id,
    'license_key', v_license_key,
    'expiry_date', (now() + (v_days || ' days')::interval)::text,
    'max_employees', v_max_employees
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$function$;


-- 5) update_license_max_employees_rpc: العدّ يستند للموزعين فقط
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

  -- العدّ الآن للموزعين الميدانيين النشطين فقط
  SELECT COUNT(*) INTO v_current FROM profiles
  WHERE organization_id = v_org_id
    AND role = 'EMPLOYEE'
    AND employee_type = 'FIELD_AGENT'
    AND is_active = true;

  UPDATE developer_licenses SET max_employees = p_max_employees WHERE id = p_license_id;

  RETURN jsonb_build_object('current_employees', v_current, 'exceeds_limit', v_current > p_max_employees);
END;
$function$;
