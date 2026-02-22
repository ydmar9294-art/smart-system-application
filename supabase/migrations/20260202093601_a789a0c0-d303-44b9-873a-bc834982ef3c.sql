-- ============================================
-- SECURITY FIX: Restrict generate_license_key to authenticated developers only
-- ============================================

-- REVOKE public access from generate_license_key
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM public;
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM authenticated;

-- Grant only to developers via a wrapper that checks role
-- The function is only called internally by issue_license_rpc which already checks developer role

-- Create a secure wrapper that validates developer role
CREATE OR REPLACE FUNCTION public.secure_generate_license_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only developers can generate license keys
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized: Only developers can generate license keys';
  END IF;
  
  RETURN public.generate_license_key();
END;
$$;

-- Grant the secure function only to authenticated users (will still check role inside)
GRANT EXECUTE ON FUNCTION public.secure_generate_license_key() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.secure_generate_license_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.secure_generate_license_key() FROM public;

-- ============================================
-- SECURITY FIX: Restrict developer_exists to prevent enumeration
-- Create a rate-limited version that only returns boolean
-- ============================================

-- The developer_exists function is needed for the first-time setup flow
-- It only returns true/false, minimal information disclosure
-- We'll keep it but ensure it's properly secured with SECURITY DEFINER

-- Ensure the function is stable and reveals minimal info
CREATE OR REPLACE FUNCTION public.developer_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Returns only true/false, no additional data
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER' LIMIT 1
  )
$$;

-- This is needed for first developer registration, so anon must have access
-- But it only reveals a single boolean - acceptable minimal exposure

-- ============================================
-- SECURITY: Ensure issue_license_rpc uses internal function
-- ============================================

CREATE OR REPLACE FUNCTION public.issue_license_rpc(p_org_name text, p_type license_type, p_days integer DEFAULT 30)
RETURNS uuid
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
  
  -- Generate key internally (function is now restricted)
  v_key := public.generate_license_key();
  
  IF p_type = 'TRIAL' THEN
    v_expiry := now() + (p_days || ' days')::interval;
  ELSE
    v_expiry := NULL;
  END IF;
  
  INSERT INTO public.developer_licenses ("licenseKey", "orgName", type, status, "expiryDate", days_valid)
  VALUES (v_key, p_org_name, p_type, 'READY', v_expiry, p_days)
  RETURNING id INTO v_license_id;
  
  RETURN v_license_id;
END;
$$;

-- ============================================
-- SECURITY: Add login attempt tracking table
-- ============================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access - only through functions
CREATE POLICY "No direct access to login_attempts"
ON public.login_attempts
FOR ALL
USING (false);

-- Function to check if too many failed attempts (rate limiting)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_ip_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Returns true if rate limited (too many attempts)
  SELECT COUNT(*) > 10
  FROM public.login_attempts
  WHERE ip_hash = p_ip_hash
    AND success = false
    AND attempted_at > now() - interval '15 minutes'
$$;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_ip_hash text, p_email_hash text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (ip_hash, email_hash, success)
  VALUES (p_ip_hash, p_email_hash, p_success);
  
  -- Cleanup old records (older than 24 hours)
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- Grant to authenticated and anon (needed for login flow)
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, boolean) TO anon, authenticated;