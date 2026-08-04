-- ============ 1. Products: archive support ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

UPDATE public.products SET is_archived = true, archived_at = now()
WHERE is_deleted = true AND is_archived = false;

-- ============ 2. Non-negative stock guarantees ============
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);

ALTER TABLE public.distributor_inventory DROP CONSTRAINT IF EXISTS distributor_inventory_qty_non_negative;
ALTER TABLE public.distributor_inventory ADD CONSTRAINT distributor_inventory_qty_non_negative CHECK (quantity >= 0);

-- ============ 3. Deliveries: approval workflow ============
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.deliveries SET status = 'received' WHERE status IN ('completed', 'COMPLETED');

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('pending', 'received', 'rejected', 'cancelled'));

ALTER TABLE public.deliveries ALTER COLUMN status SET DEFAULT 'pending';

-- allow the approval RPCs' owning role and org members' RPCs to update
DROP POLICY IF EXISTS "Org members can update deliveries" ON public.deliveries;
CREATE POLICY "Org members can update deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

-- ============ 4. Indexes ============
CREATE INDEX IF NOT EXISTS idx_products_org_archived ON public.products (organization_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_dist_inv_org_dist_product ON public.distributor_inventory (organization_id, distributor_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_created ON public.stock_movements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_org_status ON public.deliveries (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_distributor ON public.deliveries (distributor_id, status);

-- ============ 5. Unified stock movement engine ============
-- Central warehouse adjustment with row lock + friendly Arabic errors
CREATE OR REPLACE FUNCTION public.adjust_central_stock(
  p_org_id uuid, p_product_id uuid, p_delta integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_stock int; v_name text;
BEGIN
  SELECT stock, name INTO v_stock, v_name
  FROM products WHERE id = p_product_id AND organization_id = p_org_id
  FOR UPDATE;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'المادة غير موجودة في هذه المنشأة';
  END IF;

  IF v_stock + p_delta < 0 THEN
    RAISE EXCEPTION 'الكمية غير كافية في المستودع الرئيسي للمادة «%»: المتاح % والمطلوب %',
      v_name, v_stock, abs(p_delta) USING ERRCODE = 'check_violation';
  END IF;

  UPDATE products SET stock = stock + p_delta, updated_at = now() WHERE id = p_product_id;
END;
$$;

-- Distributor warehouse adjustment with row lock + upsert
CREATE OR REPLACE FUNCTION public.adjust_distributor_stock(
  p_org_id uuid, p_distributor_id uuid, p_product_id uuid, p_delta integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_qty int; v_name text; v_upp int;
BEGIN
  SELECT name, COALESCE(units_per_pack, 1) INTO v_name, v_upp
  FROM products WHERE id = p_product_id AND organization_id = p_org_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'المادة غير موجودة في هذه المنشأة';
  END IF;

  SELECT quantity INTO v_qty FROM distributor_inventory
  WHERE organization_id = p_org_id AND distributor_id = p_distributor_id AND product_id = p_product_id
  FOR UPDATE;

  IF v_qty IS NULL THEN
    IF p_delta < 0 THEN
      RAISE EXCEPTION 'الكمية غير كافية في مستودع الموزع للمادة «%»: المتاح 0 والمطلوب %',
        v_name, abs(p_delta) USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO distributor_inventory
      (organization_id, distributor_id, product_id, product_name, quantity, units_per_pack_snapshot)
    VALUES (p_org_id, p_distributor_id, p_product_id, v_name, p_delta, v_upp);
    RETURN;
  END IF;

  IF v_qty + p_delta < 0 THEN
    RAISE EXCEPTION 'الكمية غير كافية في مستودع الموزع للمادة «%»: المتاح % والمطلوب %',
      v_name, v_qty, abs(p_delta) USING ERRCODE = 'check_violation';
  END IF;

  UPDATE distributor_inventory SET quantity = quantity + p_delta, updated_at = now()
  WHERE organization_id = p_org_id AND distributor_id = p_distributor_id AND product_id = p_product_id;
END;
$$;

-- Single entry point: adjusts balances AND records an auditable movement
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_org_id uuid,
  p_product_id uuid,
  p_quantity integer,              -- always positive, in PIECES
  p_movement_type text,            -- PURCHASE | DELIVERY | DELIVERY_RETURN | SALE | SALES_RETURN | PURCHASE_RETURN | ADJUSTMENT | TRANSFER
  p_source_type text,              -- CENTRAL | DISTRIBUTOR | SUPPLIER | CUSTOMER | ADJUSTMENT
  p_destination_type text,
  p_source_id uuid DEFAULT NULL,
  p_destination_id uuid DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر';
  END IF;

  -- OUT of source
  IF p_source_type = 'CENTRAL' THEN
    PERFORM adjust_central_stock(p_org_id, p_product_id, -p_quantity);
  ELSIF p_source_type = 'DISTRIBUTOR' THEN
    PERFORM adjust_distributor_stock(p_org_id, p_source_id, p_product_id, -p_quantity);
  END IF;

  -- IN to destination
  IF p_destination_type = 'CENTRAL' THEN
    PERFORM adjust_central_stock(p_org_id, p_product_id, p_quantity);
  ELSIF p_destination_type = 'DISTRIBUTOR' THEN
    PERFORM adjust_distributor_stock(p_org_id, p_destination_id, p_product_id, p_quantity);
  END IF;

  INSERT INTO stock_movements (
    organization_id, product_id, quantity, movement_type,
    source_type, destination_type, source_id, destination_id,
    reference_id, notes, created_by
  ) VALUES (
    p_org_id, p_product_id, p_quantity, p_movement_type,
    p_source_type, p_destination_type, p_source_id, p_destination_id,
    p_reference_id, p_notes, auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_central_stock(uuid, uuid, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_distributor_stock(uuid, uuid, uuid, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stock_movement(uuid, uuid, integer, text, text, text, uuid, uuid, uuid, text) FROM anon, authenticated;