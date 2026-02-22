
-- Must DROP and recreate views since column order changed
DROP VIEW IF EXISTS public.customers_public;
CREATE VIEW public.customers_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  balance,
  organization_id,
  created_by,
  created_at
FROM public.customers;

DROP VIEW IF EXISTS public.view_customer_balances;
CREATE VIEW public.view_customer_balances
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  phone,
  created_at,
  balance,
  organization_id
FROM public.customers;

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  role,
  employee_type,
  organization_id,
  created_at,
  updated_at
FROM public.profiles;

DROP VIEW IF EXISTS public.pending_employees_public;
CREATE VIEW public.pending_employees_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  role,
  employee_type,
  organization_id,
  is_used,
  expires_at,
  created_by,
  created_at
FROM public.pending_employees;

DROP VIEW IF EXISTS public.view_sales_summary CASCADE;
CREATE VIEW public.view_sales_summary
WITH (security_invoker = true)
AS
SELECT 
  id,
  customer_id,
  customer_name,
  grand_total,
  paid_amount,
  remaining,
  payment_type,
  is_voided,
  organization_id,
  created_by,
  created_at,
  EXTRACT(EPOCH FROM created_at)::numeric AS timestamp
FROM public.sales;
