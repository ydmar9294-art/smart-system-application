-- =====================================================
-- Security Fix: Protect PII in profiles and customers tables
-- =====================================================

-- 1. Create a secure view for profiles that excludes sensitive fields
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
    id,
    full_name,
    role,
    employee_type,
    organization_id,
    created_at,
    updated_at
    -- Excluded: email, phone, google_id, license_key, email_verified
FROM public.profiles;

-- 2. Create a secure view for customers with minimal exposure
CREATE OR REPLACE VIEW public.customers_public
WITH (security_invoker=on) AS
SELECT 
    id,
    name,
    balance,
    organization_id,
    created_at,
    created_by
    -- Excluded: phone, location, updated_at
FROM public.customers;

-- 3. Drop overly permissive policies on profiles table
DROP POLICY IF EXISTS "Developers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Sales managers can view org profiles" ON public.profiles;

-- 4. Create new restrictive policies for profiles
-- Only allow users to see their own full profile
-- Other users can only access profiles through the public view
CREATE POLICY "Users can view their own full profile" 
ON public.profiles FOR SELECT 
USING (id = auth.uid());

-- Developers need access for system management but only through secure view
-- Direct table access limited to own profile
CREATE POLICY "Developers can view profiles via secure view only" 
ON public.profiles FOR SELECT 
USING (
    has_role(auth.uid(), 'DEVELOPER'::user_role) 
    AND id = auth.uid()
);

-- 5. Tighten customers table policies
-- Drop the overly broad policy
DROP POLICY IF EXISTS "Org users can manage customers" ON public.customers;

-- Create separate policies for each operation with proper restrictions
-- Only owners and field agents (distributors) can create customers
CREATE POLICY "Authorized users can create customers" 
ON public.customers FOR INSERT 
WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (
        has_role(auth.uid(), 'OWNER'::user_role)
        OR has_employee_type(auth.uid(), 'FIELD_AGENT'::employee_type)
    )
);

-- Only owners can update customers
CREATE POLICY "Owners can update customers" 
ON public.customers FOR UPDATE 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
)
WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
);

-- Only owners can delete customers (soft delete should be used in practice)
CREATE POLICY "Owners can delete customers" 
ON public.customers FOR DELETE 
USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
);

-- 6. Create function to get limited profile info for org members
CREATE OR REPLACE FUNCTION public.get_org_member_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT full_name 
    FROM public.profiles 
    WHERE id = _user_id
$$;

-- 7. Create function to check if a user is in the same organization
CREATE OR REPLACE FUNCTION public.is_same_organization(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles p1
        JOIN public.profiles p2 ON p1.organization_id = p2.organization_id
        WHERE p1.id = _user_id 
        AND p2.id = _target_user_id
        AND p1.organization_id IS NOT NULL
    )
$$;

-- 8. Grant SELECT on the secure views to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.customers_public TO authenticated;