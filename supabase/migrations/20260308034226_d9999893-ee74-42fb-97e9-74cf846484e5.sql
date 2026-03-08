
-- Phase 3: Allow developers to update organization names
CREATE POLICY "Developers can update orgs"
ON public.organizations
FOR UPDATE
USING (is_developer())
WITH CHECK (is_developer());
