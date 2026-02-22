-- Create function to bootstrap first developer with secret code
CREATE OR REPLACE FUNCTION public.bootstrap_developer_oauth(
  p_user_id UUID,
  p_google_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_bootstrap_code TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dev_count INTEGER;
  v_valid_code TEXT := 'DEV-MASTER-2024-INIT';
BEGIN
  -- Validate bootstrap code
  IF p_bootstrap_code IS NULL OR trim(p_bootstrap_code) != v_valid_code THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'message', 'كود التفعيل غير صحيح');
  END IF;
  
  -- Check if developer already exists
  SELECT COUNT(*) INTO v_dev_count
  FROM public.user_roles
  WHERE role = 'DEVELOPER';
  
  IF v_dev_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVELOPER_EXISTS', 'message', 'المطور مسجل بالفعل في النظام');
  END IF;
  
  -- Create profile for developer
  INSERT INTO public.profiles (id, full_name, role, google_id, email, email_verified)
  VALUES (p_user_id, COALESCE(p_full_name, 'المطور الرئيسي'), 'DEVELOPER', p_google_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    role = 'DEVELOPER',
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  -- Add developer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'DEVELOPER')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', 'DEVELOPER',
    'message', 'تم تسجيلك كمطور رئيسي بنجاح'
  );
END;
$$;