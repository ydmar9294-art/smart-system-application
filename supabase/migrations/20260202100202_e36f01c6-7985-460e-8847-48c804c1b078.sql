-- =====================================================
-- IRREVERSIBLE DEVELOPER HARDENING
-- Enforces single developer constraint at database level
-- =====================================================

-- 1. Add unique constraint for DEVELOPER role (only one can exist)
-- First, create a partial unique index that only allows one DEVELOPER
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_developer 
ON public.user_roles (role) 
WHERE role = 'DEVELOPER';

-- 2. Create a trigger function to block additional developer creation
CREATE OR REPLACE FUNCTION public.enforce_single_developer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dev_count INTEGER;
BEGIN
    -- Only check for DEVELOPER role
    IF NEW.role = 'DEVELOPER' THEN
        -- Count existing developers
        SELECT COUNT(*) INTO dev_count
        FROM public.user_roles
        WHERE role = 'DEVELOPER';
        
        -- If any developer exists, block the insert
        IF dev_count > 0 THEN
            RAISE EXCEPTION 'System is locked: Developer already exists. No additional developers can be created.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Create trigger to enforce single developer on INSERT
DROP TRIGGER IF EXISTS trg_enforce_single_developer ON public.user_roles;
CREATE TRIGGER trg_enforce_single_developer
    BEFORE INSERT ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_developer();

-- 4. Update developer_exists to ALWAYS return true (hide bootstrap state after creation)
-- This prevents information disclosure about system state
CREATE OR REPLACE FUNCTION public.developer_exists()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_dev BOOLEAN;
BEGIN
    -- Check if developer exists
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER' LIMIT 1
    ) INTO has_dev;
    
    -- SECURITY: Always return true to hide bootstrap state
    -- If developer exists: true (accurate)
    -- If no developer yet: true (intentional - hides that system is in bootstrap)
    -- This prevents attackers from discovering system state
    RETURN TRUE;
END;
$$;

-- 5. Revoke public execution from developer_exists (extra layer)
REVOKE EXECUTE ON FUNCTION public.developer_exists() FROM public;
REVOKE EXECUTE ON FUNCTION public.developer_exists() FROM anon;

-- 6. Grant only to authenticated users (for internal checks only)
GRANT EXECUTE ON FUNCTION public.developer_exists() TO authenticated;

-- 7. Update RLS policy to block any developer role insertion except first
DROP POLICY IF EXISTS "First developer can insert their role" ON public.user_roles;
CREATE POLICY "First developer can insert their role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
    (user_id = auth.uid()) 
    AND (role = 'DEVELOPER') 
    AND (NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER'))
);

-- 8. Block UPDATE of role to DEVELOPER if developer already exists
DROP POLICY IF EXISTS "Block role change to developer" ON public.user_roles;
CREATE POLICY "Block role change to developer"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
    -- Allow update only if not changing to DEVELOPER when one exists
    role != 'DEVELOPER' OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER' AND user_id != auth.uid())
)
WITH CHECK (
    role != 'DEVELOPER' OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER' AND user_id != auth.uid())
);