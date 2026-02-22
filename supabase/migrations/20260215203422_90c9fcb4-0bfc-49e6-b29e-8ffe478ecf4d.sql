-- Allow OWNER to view all profiles in their organization
CREATE POLICY "Owners can view org profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- Allow SALES_MANAGER to view org profiles (needed for employee management)
CREATE POLICY "Sales managers can view org profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Allow ACCOUNTANT to view org profiles (needed for reports)
CREATE POLICY "Accountants can view org profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_employee_type(auth.uid(), 'ACCOUNTANT')
);