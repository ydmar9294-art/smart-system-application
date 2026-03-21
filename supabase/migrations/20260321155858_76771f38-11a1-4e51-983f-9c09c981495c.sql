-- Add INSERT policy for distributors on visit_plans
-- Distributors need to be able to create ad-hoc visits
CREATE POLICY "Distributors insert own visit plans" ON public.visit_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    distributor_id = auth.uid()
    AND organization_id = get_my_org_id()
  );
