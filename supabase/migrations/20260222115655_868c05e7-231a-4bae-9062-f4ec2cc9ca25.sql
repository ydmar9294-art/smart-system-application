
-- 1. Create developer_allowlist table
CREATE TABLE public.developer_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.developer_allowlist ENABLE ROW LEVEL SECURITY;

-- 3. Only developers can read/manage the allowlist
CREATE POLICY "Only developers can manage allowlist"
ON public.developer_allowlist
FOR ALL
USING (has_role(auth.uid(), 'DEVELOPER'::user_role))
WITH CHECK (has_role(auth.uid(), 'DEVELOPER'::user_role));

-- 4. Block anonymous access
CREATE POLICY "Block anon access to developer_allowlist"
ON public.developer_allowlist
FOR ALL
USING (false);

-- 5. Seed the initial developer email
INSERT INTO public.developer_allowlist (email) VALUES ('abufuadeid419@gmail.com');

-- 6. Create server-side function to auto-assign developer role on login
-- This runs as SECURITY DEFINER (elevated privileges) so users can't manipulate it
CREATE OR REPLACE FUNCTION public.auto_assign_developer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_existing_role BOOLEAN;
BEGIN
  -- Extract user info from the new auth user
  v_user_id := NEW.id;
  v_email := NEW.email;
  
  -- Check if email is in developer allowlist
  IF EXISTS (SELECT 1 FROM public.developer_allowlist WHERE email = v_email) THEN
    -- Check if role already assigned
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'DEVELOPER'
    ) INTO v_existing_role;
    
    IF NOT v_existing_role THEN
      -- Assign developer role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'DEVELOPER')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    -- Upsert developer profile
    INSERT INTO public.profiles (id, full_name, email, role, email_verified, is_active)
    VALUES (v_user_id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1)), v_email, 'DEVELOPER', true, true)
    ON CONFLICT (id) DO UPDATE SET
      role = 'DEVELOPER',
      email = v_email,
      email_verified = true,
      is_active = true,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Attach trigger to auth.users on sign-in (fires on INSERT for new users)
-- We use a trigger on profiles or a login hook approach instead
-- Actually, we need a different approach since we can't attach triggers to auth.users directly in Cloud
-- Instead, we'll create an RPC that the auth-status edge function calls

-- Drop the trigger approach and create an RPC instead
DROP FUNCTION IF EXISTS public.auto_assign_developer_role() CASCADE;

-- Create a SECURITY DEFINER function that auth-status can call via service role
CREATE OR REPLACE FUNCTION public.check_and_assign_developer_role(p_user_id UUID, p_email TEXT, p_full_name TEXT DEFAULT '')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_developer BOOLEAN := false;
BEGIN
  -- Check if email is in developer allowlist
  SELECT EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE email = p_email
  ) INTO v_is_developer;
  
  IF NOT v_is_developer THEN
    RETURN false;
  END IF;
  
  -- Assign developer role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'DEVELOPER')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Upsert developer profile
  INSERT INTO public.profiles (id, full_name, email, role, email_verified, is_active)
  VALUES (p_user_id, COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)), p_email, 'DEVELOPER', true, true)
  ON CONFLICT (id) DO UPDATE SET
    role = 'DEVELOPER',
    email = p_email,
    email_verified = true,
    is_active = true,
    updated_at = now();
  
  RETURN true;
END;
$$;

-- 8. Remove old bootstrap function
DROP FUNCTION IF EXISTS public.bootstrap_developer_oauth(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- 9. Remove the enforce_single_developer trigger if it exists (we now use allowlist)
DROP TRIGGER IF EXISTS enforce_single_developer ON public.user_roles;
DROP FUNCTION IF EXISTS public.enforce_single_developer() CASCADE;
