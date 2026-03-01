
-- =============================================
-- FIX 1: Restrict developer_licenses SELECT to hide sensitive fields
-- Replace broad "Users can read own license" with a secure RPC
-- =============================================

-- Drop the existing policy that exposes all columns
DROP POLICY IF EXISTS "Users can read own license" ON public.developer_licenses;

-- Create a new restrictive policy: users can only read via the safe RPC
-- No direct SELECT for non-developers
-- Developers keep their existing ALL policy

-- Create a safe RPC that returns only non-sensitive license fields
CREATE OR REPLACE FUNCTION public.get_my_license_info()
RETURNS TABLE(
  id UUID,
  license_key TEXT,
  org_name TEXT,
  type TEXT,
  status TEXT,
  expiry_date TIMESTAMPTZ,
  days_valid INT,
  max_employees INT,
  organization_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dl.id,
    dl."licenseKey" AS license_key,
    dl."orgName" AS org_name,
    dl.type,
    dl.status,
    dl."expiryDate" AS expiry_date,
    dl.days_valid,
    dl.max_employees,
    dl.organization_id,
    dl.created_at
  FROM developer_licenses dl
  WHERE dl."licenseKey" IN (
    SELECT p.license_key FROM profiles p WHERE p.id = auth.uid()
  )
$$;

-- =============================================
-- FIX 2: Remove permissive INSERT on audit_logs
-- All audit log inserts go through SECURITY DEFINER triggers/RPCs
-- =============================================

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
