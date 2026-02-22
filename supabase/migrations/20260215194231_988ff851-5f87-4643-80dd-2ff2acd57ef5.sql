
CREATE OR REPLACE FUNCTION public.can_create_employee_type(
  p_creator_role user_role,
  p_creator_employee_type employee_type,
  p_target_employee_type employee_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_creator_role = 'OWNER' THEN true
    WHEN p_creator_employee_type = 'SALES_MANAGER' AND p_target_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER') THEN true
    ELSE false
  END;
$$;
