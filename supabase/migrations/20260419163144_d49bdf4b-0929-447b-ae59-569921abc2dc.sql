-- 1) Add new columns to developer_licenses for self-service trial metadata
ALTER TABLE public.developer_licenses
  ADD COLUMN IF NOT EXISTS owner_full_name text,
  ADD COLUMN IF NOT EXISTS distributors_count integer,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS is_self_service_trial boolean NOT NULL DEFAULT false;

-- 2) RPC: Self-service trial creation
-- Creates organization + 15-day TRIAL license + activates the OWNER profile atomically.
-- Caller must be authenticated; uses auth.uid() for ownership.
CREATE OR REPLACE FUNCTION public.create_self_service_trial(
  p_full_name text,
  p_org_name text,
  p_distributors_count integer,
  p_phone text,
  p_whatsapp text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED', 'message', 'يجب تسجيل الدخول أولاً');
  END IF;

  -- Validation
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

  -- Get user's email from auth
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Reject if user already belongs to an org / has a role
  SELECT role, organization_id INTO v_existing_role, v_existing_org
  FROM public.profiles WHERE id = v_uid;

  IF v_existing_org IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_MEMBER',
      'message', 'حسابك مرتبط بشركة فعلاً. لا يمكن إنشاء حساب تجريبي جديد');
  END IF;

  -- max_employees = at least the requested distributors + small buffer (min 5)
  v_max_employees := GREATEST(p_distributors_count + 2, 5);

  -- Create organization
  INSERT INTO public.organizations(name)
  VALUES (trim(p_org_name))
  RETURNING id INTO v_org_id;

  -- Generate license key: TRIAL-YYYYMMDD-XXXX (uppercase short uuid)
  v_license_key := 'TRIAL-' || to_char(now(), 'YYYYMMDD') || '-' ||
                   upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Create license (ACTIVE immediately for self-service trial)
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

  -- Upsert profile as OWNER
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
$$;

GRANT EXECUTE ON FUNCTION public.create_self_service_trial(text, text, integer, text, text) TO authenticated;