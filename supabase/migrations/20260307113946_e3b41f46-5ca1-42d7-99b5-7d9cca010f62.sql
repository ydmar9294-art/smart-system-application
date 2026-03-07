
-- Phase 1: Add discount fields to sales table
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;

-- Phase 3: Create price change history table for warehouse manager price control
CREATE TABLE IF NOT EXISTS public.price_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_by_name TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value NUMERIC NOT NULL DEFAULT 0,
  new_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read price history" ON public.price_change_history
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "Org members can insert price history" ON public.price_change_history
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "Developers can read all price history" ON public.price_change_history
  FOR SELECT TO authenticated
  USING (is_developer());
