
-- RPC to check if an email exists in auth.users (for forgot password flow)
-- SECURITY DEFINER allows anon users to call this without exposing the auth schema
CREATE OR REPLACE FUNCTION public.check_email_exists_rpc(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;
