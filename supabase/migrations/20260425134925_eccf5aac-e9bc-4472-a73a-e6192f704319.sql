-- 1. Add pack/piece fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER NOT NULL DEFAULT 1 CHECK (units_per_pack >= 1),
  ADD COLUMN IF NOT EXISTS pack_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pack_consumer_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_unit TEXT NOT NULL DEFAULT 'PIECE' CHECK (pricing_unit IN ('PIECE','PACK')),
  ADD COLUMN IF NOT EXISTS stock_display_unit TEXT NOT NULL DEFAULT 'PIECE' CHECK (stock_display_unit IN ('PIECE','PACK','BOTH')),
  ADD COLUMN IF NOT EXISTS allow_pack_sales BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_piece_sales BOOLEAN NOT NULL DEFAULT true;

-- 2. Add fields to sale_items for pack/piece breakdown
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sold_unit TEXT NOT NULL DEFAULT 'PIECE' CHECK (sold_unit IN ('PIECE','PACK','MIXED'));

-- 3. Same for sales_return_items
ALTER TABLE public.sales_return_items
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1;

-- 4. Same for purchase_return_items and delivery_items
ALTER TABLE public.purchase_return_items
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.delivery_items
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1;

-- 5. Same for purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1;

-- 6. Same for distributor_inventory (display purposes)
ALTER TABLE public.distributor_inventory
  ADD COLUMN IF NOT EXISTS units_per_pack_snapshot INTEGER NOT NULL DEFAULT 1;

-- 7. Trigger: prevent changing units_per_pack when stock > 0 OR sales exist
CREATE OR REPLACE FUNCTION public.prevent_units_per_pack_change_if_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_sales BOOLEAN;
BEGIN
  -- Only check when units_per_pack actually changes
  IF NEW.units_per_pack IS DISTINCT FROM OLD.units_per_pack THEN
    -- Block if current stock exists
    IF OLD.stock IS NOT NULL AND OLD.stock > 0 THEN
      RAISE EXCEPTION 'لا يمكن تغيير عدد القطع داخل الطرد لأن المخزون الحالي = %. يجب تصفير المخزون أولاً.', OLD.stock
        USING ERRCODE = 'check_violation';
    END IF;
    
    -- Block if sale_items reference this product
    SELECT EXISTS(
      SELECT 1 FROM public.sale_items si 
      WHERE si.product_id = OLD.id 
      LIMIT 1
    ) INTO has_sales;
    
    IF has_sales THEN
      RAISE EXCEPTION 'لا يمكن تغيير عدد القطع داخل الطرد لأن هناك فواتير سابقة تستخدم هذه المادة.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_units_per_pack_change ON public.products;
CREATE TRIGGER trg_prevent_units_per_pack_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_units_per_pack_change_if_stock();

-- 8. Trigger: auto-sync pack_price from base_price when units_per_pack/base_price changes
CREATE OR REPLACE FUNCTION public.sync_pack_and_piece_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If pricing_unit = PIECE, derive pack_price from base_price * units_per_pack
  IF NEW.pricing_unit = 'PIECE' THEN
    NEW.pack_price := COALESCE(NEW.base_price, 0) * GREATEST(NEW.units_per_pack, 1);
    NEW.pack_consumer_price := COALESCE(NEW.consumer_price, 0) * GREATEST(NEW.units_per_pack, 1);
  -- If pricing_unit = PACK, derive base_price from pack_price / units_per_pack
  ELSIF NEW.pricing_unit = 'PACK' AND NEW.units_per_pack > 0 THEN
    NEW.base_price := COALESCE(NEW.pack_price, 0) / NEW.units_per_pack;
    NEW.consumer_price := COALESCE(NEW.pack_consumer_price, 0) / NEW.units_per_pack;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pack_piece_prices ON public.products;
CREATE TRIGGER trg_sync_pack_piece_prices
  BEFORE INSERT OR UPDATE OF base_price, consumer_price, pack_price, pack_consumer_price, units_per_pack, pricing_unit
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pack_and_piece_prices();

-- 9. Index for performance on sale_items product lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);