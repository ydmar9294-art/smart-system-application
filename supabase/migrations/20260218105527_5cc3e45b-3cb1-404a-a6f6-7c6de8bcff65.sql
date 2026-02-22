
-- Fix: Remove the policy that allows owners to read their own licenseKey from developer_licenses.
-- Owners activate their license by entering the key manually; they don't need to read it back.
-- Developers already have full access via the "Developers can manage licenses" policy.

DROP POLICY IF EXISTS "Users can view their own license" ON public.developer_licenses;
