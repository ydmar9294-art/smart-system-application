ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SYP',
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS customer_id UUID;

ALTER TABLE public.collections ALTER COLUMN sale_id DROP NOT NULL;

UPDATE public.collections SET original_amount = amount WHERE original_amount = 0 AND amount > 0;

UPDATE public.collections c SET customer_id = s.customer_id
FROM public.sales s WHERE c.sale_id = s.id AND c.customer_id IS NULL;

CREATE OR REPLACE FUNCTION public.validate_collection_direction()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.direction NOT IN ('IN','OUT') THEN RAISE EXCEPTION 'direction must be IN or OUT'; END IF;
  IF NEW.currency NOT IN ('SYP','USD') THEN RAISE EXCEPTION 'currency must be SYP or USD'; END IF;
  IF NEW.direction = 'IN' AND NEW.sale_id IS NULL THEN RAISE EXCEPTION 'IN collections require sale_id'; END IF;
  IF NEW.direction = 'OUT' AND NEW.customer_id IS NULL THEN RAISE EXCEPTION 'OUT collections require customer_id'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_collection_direction ON public.collections;
CREATE TRIGGER trg_validate_collection_direction
BEFORE INSERT OR UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.validate_collection_direction();

CREATE INDEX IF NOT EXISTS idx_collections_direction
  ON public.collections (organization_id, direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_customer
  ON public.collections (organization_id, customer_id)
  WHERE customer_id IS NOT NULL;