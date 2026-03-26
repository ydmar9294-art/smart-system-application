-- Allow org managers (OWNER, SALES_MANAGER) to read devices of users in the same organization
CREATE POLICY "Org managers can read org devices"
ON public.devices
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.id FROM profiles p
    WHERE p.organization_id = get_my_org_id()
  )
  AND (
    get_my_role() = 'OWNER'
    OR get_my_role() = 'DEVELOPER'
    OR (
      get_my_role() = 'EMPLOYEE'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.employee_type = 'SALES_MANAGER'
      )
    )
  )
);