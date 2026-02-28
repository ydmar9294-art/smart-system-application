
-- Allow owners to INSERT their own deletion request
CREATE POLICY "Owners can submit deletion request"
  ON public.deletion_requests FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND organization_id = get_my_org_id()
    AND get_my_role() = 'OWNER'
  );

-- Allow owners to read their own deletion requests
CREATE POLICY "Owners can read own deletion requests"
  ON public.deletion_requests FOR SELECT
  USING (owner_id = auth.uid());
