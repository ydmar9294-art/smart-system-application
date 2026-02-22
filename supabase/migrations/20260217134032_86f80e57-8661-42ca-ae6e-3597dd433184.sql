
-- 1. Secure public views with security_invoker=true
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = true) AS
SELECT id, full_name, role, employee_type, organization_id, created_at, updated_at
FROM public.profiles;

DROP VIEW IF EXISTS public.customers_public;
CREATE VIEW public.customers_public WITH (security_invoker = true) AS
SELECT id, name, balance, organization_id, created_by, created_at
FROM public.customers;

DROP VIEW IF EXISTS public.pending_employees_public;
CREATE VIEW public.pending_employees_public WITH (security_invoker = true) AS
SELECT id, name, organization_id, role, employee_type, is_used, created_by, created_at, expires_at
FROM public.pending_employees;

-- 2. Add notification retention policy - auto-delete notifications older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_notifications WHERE created_at < now() - interval '30 days';
END;
$$;
