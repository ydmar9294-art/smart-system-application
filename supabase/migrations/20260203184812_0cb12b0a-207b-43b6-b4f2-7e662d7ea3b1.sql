-- =====================================================
-- Security Fix: Consolidate profiles policies & protect pending_employees activation codes
-- =====================================================

-- ========== PART 1: Consolidate profiles SELECT policies ==========

-- Drop all existing SELECT policies on profiles to eliminate overlap
DROP POLICY IF EXISTS "Default deny profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Developers can view profiles via secure view only" ON public.profiles;

-- Create single consolidated SELECT policy
-- Users can ONLY see their own profile (with all fields)
-- Other users must use profiles_public view for non-sensitive data
CREATE POLICY "Users can only view own profile" 
ON public.profiles FOR SELECT 
USING (id = auth.uid());

-- ========== PART 2: Protect pending_employees activation codes ==========

-- Create a secure view that hides sensitive activation_code field
CREATE OR REPLACE VIEW public.pending_employees_public
WITH (security_invoker=on) AS
SELECT 
    id,
    organization_id,
    name,
    -- phone excluded for privacy
    role,
    employee_type,
    is_used,
    expires_at,
    created_by,
    created_at
    -- Excluded: activation_code, phone
FROM public.pending_employees;

-- Grant access to authenticated users
GRANT SELECT ON public.pending_employees_public TO authenticated;

-- Drop existing policies on pending_employees
DROP POLICY IF EXISTS "Owners can manage pending employees" ON public.pending_employees;
DROP POLICY IF EXISTS "Sales managers can manage pending employees" ON public.pending_employees;

-- Create restrictive policies for pending_employees
-- Only the creator or owner can see the activation code (via direct table access)
CREATE POLICY "Owners can view pending employees with codes" 
ON public.pending_employees FOR SELECT 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
);

CREATE POLICY "Sales managers can view pending employees with codes" 
ON public.pending_employees FOR SELECT 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_employee_type(auth.uid(), 'SALES_MANAGER'::employee_type)
);

-- INSERT policy - only authorized users can create pending employees
CREATE POLICY "Authorized users can create pending employees" 
ON public.pending_employees FOR INSERT 
WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (
        has_role(auth.uid(), 'OWNER'::user_role)
        OR has_employee_type(auth.uid(), 'SALES_MANAGER'::employee_type)
    )
);

-- UPDATE policy - only owners and sales managers can update
CREATE POLICY "Authorized users can update pending employees" 
ON public.pending_employees FOR UPDATE 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
        has_role(auth.uid(), 'OWNER'::user_role)
        OR has_employee_type(auth.uid(), 'SALES_MANAGER'::employee_type)
    )
)
WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (
        has_role(auth.uid(), 'OWNER'::user_role)
        OR has_employee_type(auth.uid(), 'SALES_MANAGER'::employee_type)
    )
);

-- DELETE policy - only owners can delete
CREATE POLICY "Owners can delete pending employees" 
ON public.pending_employees FOR DELETE 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
);

-- ========== PART 3: Add default deny for anon access ==========

-- Ensure anonymous users cannot access pending_employees
CREATE POLICY "Block anonymous access to pending_employees" 
ON public.pending_employees FOR ALL 
TO anon
USING (false)
WITH CHECK (false);