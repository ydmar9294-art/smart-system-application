
-- Phase 1: Add consumer_price column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS consumer_price numeric NOT NULL DEFAULT 0;

-- Add index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_products_consumer_price ON public.products(organization_id, consumer_price);

-- Phase 2: Create purchase_batches table for FIFO inventory tracking
CREATE TABLE IF NOT EXISTS public.purchase_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  purchase_id uuid REFERENCES public.purchases(id),
  quantity_purchased integer NOT NULL DEFAULT 0,
  quantity_remaining integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  batch_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on purchase_batches
ALTER TABLE public.purchase_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_batches
CREATE POLICY "Users can view purchase batches in their org"
ON public.purchase_batches FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid())
  OR has_role(auth.uid(), 'DEVELOPER'::user_role)
);

CREATE POLICY "Owners can manage purchase batches"
ON public.purchase_batches FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'OWNER'::user_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'OWNER'::user_role)
);

CREATE POLICY "Warehouse keepers can manage purchase batches"
ON public.purchase_batches FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER'::employee_type)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER'::employee_type)
);

-- Indexes for FIFO queries (oldest batches first with remaining stock)
CREATE INDEX IF NOT EXISTS idx_purchase_batches_fifo 
ON public.purchase_batches(organization_id, product_id, batch_date ASC)
WHERE quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_purchase_batches_product 
ON public.purchase_batches(product_id, quantity_remaining)
WHERE quantity_remaining > 0;
