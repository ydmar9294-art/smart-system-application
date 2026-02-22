
DROP FUNCTION IF EXISTS public.bootstrap_developer_oauth(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.bootstrap_developer_oauth(p_user_id uuid, p_google_id text, p_email text, p_full_name text, p_bootstrap_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dev_count INTEGER;
  v_valid_code TEXT := 'DEV-MASTER-2024-INIT';
BEGIN
  IF p_bootstrap_code IS NULL OR p_bootstrap_code != v_valid_code THEN
    RAISE EXCEPTION 'Invalid bootstrap code';
  END IF;

  SELECT COUNT(*) INTO v_dev_count FROM public.user_roles WHERE role = 'DEVELOPER';
  IF v_dev_count > 0 THEN
    RAISE EXCEPTION 'Developer already exists';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, google_id, role, email_verified)
  VALUES (p_user_id, p_full_name, p_email, p_google_id, 'DEVELOPER', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    google_id = EXCLUDED.google_id,
    role = 'DEVELOPER',
    email_verified = true,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'DEVELOPER')
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'role', 'DEVELOPER');
END;
$function$;
