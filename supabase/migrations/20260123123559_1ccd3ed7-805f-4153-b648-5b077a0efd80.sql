-- Fix security issues with views by using security_invoker

DROP VIEW IF EXISTS public.view_customer_balances;
DROP VIEW IF EXISTS public.view_sales_summary;

-- Customer Balances View with security_invoker
CREATE VIEW public.view_customer_balances
WITH (security_invoker = on) AS
SELECT 
  c.id,
  c.organization_id,
  c.name,
  c.phone,
  c.balance,
  c.created_at
FROM public.customers c;

-- Sales Summary View with security_invoker
CREATE VIEW public.view_sales_summary
WITH (security_invoker = on) AS
SELECT 
  s.id,
  s.organization_id,
  s.customer_id,
  s.customer_name,
  s.grand_total,
  s.paid_amount,
  s.remaining,
  s.payment_type,
  s.is_voided,
  s.created_by,
  s.created_at,
  EXTRACT(EPOCH FROM s.created_at) * 1000 AS timestamp
FROM public.sales s;

-- Fix the generate_license_key function to have search_path
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;