-- Fix security issue: Restrict profile access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Owners can view org profiles"
ON public.profiles FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'OWNER')
);

-- Enable realtime for products and sales tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;