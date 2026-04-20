-- Fix: create_self_service_trial conflicts with trg_seed_default_currencies
-- The trigger auto-seeds SYP (base) + USD (secondary) on org INSERT.
-- The RPC then tried to insert user-chosen currencies → unique constraint violation.
-- Solution: use ON CONFLICT DO UPDATE so user's choice overrides defaults,
-- and demote any pre-existing base currency before promoting the chosen one.
-- Fully additive — same signature, same return shape.

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

  v_max_employees := GREATEST(p_distributors_count + 2, 5);

  -- Create org (this fires trg_seed_default_currencies → seeds SYP base + USD secondary)
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

  -- ============================================================
  -- Currency setup — must coexist with auto-seeded defaults
  -- (trigger seeded SYP=base, USD=secondary on org INSERT above)
  -- ============================================================
  IF p_base_currency_code IS NOT NULL AND length(trim(p_base_currency_code)) > 0 THEN
    v_base_code := upper(trim(p_base_currency_code));

    -- Demote any existing base in this org so we can promote the user's choice
    UPDATE public.org_currencies
       SET is_base = false
     WHERE organization_id = v_org_id
       AND is_base = true
       AND currency_code <> v_base_code;

    -- Upsert the chosen base currency (overrides auto-seeded if same code)
    INSERT INTO public.org_currencies(
      organization_id, currency_code, currency_name_ar, symbol, is_base, is_active
    )
    VALUES (
      v_org_id,
      v_base_code,
      COALESCE(NULLIF(trim(p_base_currency_name), ''), v_base_code),
      NULLIF(trim(p_base_currency_symbol), ''),
      true,
      true
    )
    ON CONFLICT (organization_id, currency_code) DO UPDATE SET
      currency_name_ar = EXCLUDED.currency_name_ar,
      symbol = COALESCE(EXCLUDED.symbol, public.org_currencies.symbol),
      is_base = true,
      is_active = true,
      updated_at = now();

    -- Optional secondary currency
    IF p_secondary_currency_code IS NOT NULL
       AND length(trim(p_secondary_currency_code)) > 0
       AND upper(trim(p_secondary_currency_code)) <> v_base_code THEN

      v_sec_code := upper(trim(p_secondary_currency_code));

      INSERT INTO public.org_currencies(
        organization_id, currency_code, currency_name_ar, symbol, is_base, is_active
      )
      VALUES (
        v_org_id,
        v_sec_code,
        COALESCE(NULLIF(trim(p_secondary_currency_name), ''), v_sec_code),
        NULLIF(trim(p_secondary_currency_symbol), ''),
        false,
        true
      )
      ON CONFLICT (organization_id, currency_code) DO UPDATE SET
        currency_name_ar = EXCLUDED.currency_name_ar,
        symbol = COALESCE(EXCLUDED.symbol, public.org_currencies.symbol),
        is_active = true,
        updated_at = now();

      IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
        INSERT INTO public.exchange_rates(
          organization_id, from_currency, to_currency, rate, created_by, created_by_name, notes
        )
        VALUES (
          v_org_id,
          v_base_code,
          v_sec_code,
          p_exchange_rate,
          v_uid,
          trim(p_full_name),
          'سعر صرف افتتاحي عند إنشاء المنشأة'
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