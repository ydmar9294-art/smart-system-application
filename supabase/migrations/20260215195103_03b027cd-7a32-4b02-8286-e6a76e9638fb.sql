-- Allow warehouse keepers to view profiles in their organization
CREATE POLICY "Warehouse keepers can view org profiles"
  ON public.profiles
  FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER'::employee_type)
  );
