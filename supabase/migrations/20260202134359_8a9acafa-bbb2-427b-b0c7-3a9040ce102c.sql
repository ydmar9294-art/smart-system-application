-- =============================================
-- Google OAuth + License Key Authentication Schema
-- =============================================

-- Add Google OAuth fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create index for google_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON public.profiles(google_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Create function to validate and activate license with Google OAuth
CREATE OR REPLACE FUNCTION public.activate_license_oauth(
  p_user_id UUID,
  p_google_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_license_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license RECORD;
  v_org_id UUID;
  v_result jsonb;
BEGIN
  -- Validate license exists and is ready
  SELECT * INTO v_license
  FROM public.developer_licenses
  WHERE "licenseKey" = trim(p_license_key)
  AND status = 'READY'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Check if license exists but is already used
    IF EXISTS (SELECT 1 FROM public.developer_licenses WHERE "licenseKey" = trim(p_license_key)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'LICENSE_ALREADY_USED', 'message', 'مفتاح الترخيص مستخدم بالفعل');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'LICENSE_NOT_FOUND', 'message', 'مفتاح الترخيص غير موجود');
  END IF;
  
  -- Check if license is expired
  IF v_license."expiryDate" IS NOT NULL AND v_license."expiryDate" < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'LICENSE_EXPIRED', 'message', 'انتهت صلاحية الترخيص');
  END IF;
  
  -- Create organization
  INSERT INTO public.organizations (name)
  VALUES (v_license."orgName")
  RETURNING id INTO v_org_id;
  
  -- Create/update profile with Google OAuth data
  INSERT INTO public.profiles (id, full_name, role, organization_id, license_key, google_id, email, email_verified)
  VALUES (p_user_id, COALESCE(p_full_name, v_license."orgName"), 'OWNER', v_org_id, p_license_key, p_google_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    role = 'OWNER',
    organization_id = v_org_id,
    license_key = p_license_key,
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'OWNER')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link user to organization
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'OWNER')
  ON CONFLICT DO NOTHING;
  
  -- Update license status
  UPDATE public.developer_licenses
  SET status = 'ACTIVE', "ownerId" = p_user_id
  WHERE id = v_license.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', 'OWNER',
    'organization_id', v_org_id,
    'organization_name', v_license."orgName",
    'license_type', v_license.type
  );
END;
$$;

-- Create function to activate employee with Google OAuth
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(
  p_user_id UUID,
  p_google_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_activation_code TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  -- Validate activation code
  IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'message', 'كود التفعيل مطلوب');
  END IF;
  
  -- Find pending employee
  SELECT * INTO v_pending
  FROM public.pending_employees
  WHERE activation_code = trim(p_activation_code)
  AND is_used = false
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Check if code exists but already used
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED', 'message', 'كود التفعيل مستخدم بالفعل');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND', 'message', 'كود التفعيل غير موجود');
  END IF;
  
  -- Create profile with Google OAuth data
  INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id, google_id, email, email_verified)
  VALUES (p_user_id, COALESCE(p_full_name, v_pending.name), v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id, p_google_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, v_pending.name),
    role = v_pending.role,
    employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_pending.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link to organization
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_pending.organization_id, p_user_id, v_pending.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark as used
  UPDATE public.pending_employees
  SET is_used = true
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', v_pending.role::text,
    'employee_type', v_pending.employee_type::text,
    'organization_id', v_pending.organization_id,
    'organization_name', v_pending.name
  );
END;
$$;

-- Create function to check if user profile exists (for OAuth callback)
CREATE OR REPLACE FUNCTION public.check_oauth_profile(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_org RECORD;
  v_license_status TEXT;
BEGIN
  -- Get profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'needs_activation', true);
  END IF;
  
  -- Get organization info
  SELECT o.* INTO v_org
  FROM public.organizations o
  JOIN public.organization_users ou ON o.id = ou.organization_id
  WHERE ou.user_id = p_user_id
  LIMIT 1;
  
  -- Get license status for non-developers
  IF v_profile.role != 'DEVELOPER' THEN
    IF v_profile.license_key IS NOT NULL THEN
      SELECT status INTO v_license_status
      FROM public.developer_licenses
      WHERE "licenseKey" = v_profile.license_key;
    ELSE
      -- For employees, get owner's license
      SELECT dl.status INTO v_license_status
      FROM public.profiles p
      JOIN public.developer_licenses dl ON dl."licenseKey" = p.license_key
      WHERE p.organization_id = v_profile.organization_id
      AND p.role = 'OWNER'
      LIMIT 1;
    END IF;
    
    -- Check if license is suspended
    IF v_license_status = 'SUSPENDED' THEN
      RETURN jsonb_build_object(
        'exists', true,
        'needs_activation', false,
        'access_denied', true,
        'reason', 'LICENSE_SUSPENDED',
        'message', 'تم إيقاف الترخيص. يرجى مراجعة قسم المالية.'
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'exists', true,
    'needs_activation', false,
    'access_denied', false,
    'role', v_profile.role,
    'employee_type', v_profile.employee_type,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'full_name', v_profile.full_name
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.activate_license_oauth TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_employee_oauth TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_oauth_profile TO authenticated;