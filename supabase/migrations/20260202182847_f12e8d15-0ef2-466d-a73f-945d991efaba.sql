-- =====================================================
-- Security Fix: Block unauthenticated public access
-- Add explicit deny policies for anonymous users
-- =====================================================

-- 1. PROFILES TABLE: Block unauthenticated access
-- The existing policies use auth.uid() but don't explicitly block anonymous
CREATE POLICY "Block unauthenticated access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 2. DEVELOPER_LICENSES TABLE: Block unauthenticated access
CREATE POLICY "Block unauthenticated access to licenses"
ON public.developer_licenses
FOR SELECT
TO anon
USING (false);

-- 3. SALES TABLE: Block unauthenticated access
CREATE POLICY "Block unauthenticated access to sales"
ON public.sales
FOR SELECT
TO anon
USING (false);

-- 4. Also add protection for related sensitive tables
-- CUSTOMERS - contains phone numbers and locations
CREATE POLICY "Block unauthenticated access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- COLLECTIONS - financial data
CREATE POLICY "Block unauthenticated access to collections"
ON public.collections
FOR SELECT
TO anon
USING (false);

-- PURCHASES - business financial data
CREATE POLICY "Block unauthenticated access to purchases"
ON public.purchases
FOR SELECT
TO anon
USING (false);

-- PRODUCTS - inventory and pricing data
CREATE POLICY "Block unauthenticated access to products"
ON public.products
FOR SELECT
TO anon
USING (false);

-- ORGANIZATIONS - business entity data
CREATE POLICY "Block unauthenticated access to organizations"
ON public.organizations
FOR SELECT
TO anon
USING (false);

-- DELIVERIES - operational data
CREATE POLICY "Block unauthenticated access to deliveries"
ON public.deliveries
FOR SELECT
TO anon
USING (false);

-- USER_ROLES - authorization data
CREATE POLICY "Block unauthenticated access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);