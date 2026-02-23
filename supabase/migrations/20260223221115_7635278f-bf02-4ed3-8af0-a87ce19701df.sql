
-- =============================================
-- 1. Fix create_sale_rpc: Add stock check
-- =============================================
CREATE OR REPLACE FUNCTION public.create_sale_rpc(p_customer_id uuid, p_items jsonb, p_payment_type text DEFAULT 'CASH'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_customer_name TEXT;
  v_grand_total NUMERIC := 0;
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_price NUMERIC;
  v_current_stock INT;
  v_product_name TEXT;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  
  -- Validate stock BEFORE creating sale
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    SELECT stock, name INTO v_current_stock, v_product_name 
    FROM products WHERE id = v_product_id AND organization_id = v_org_id;
    
    IF v_current_stock IS NULL THEN 
      RAISE EXCEPTION 'المنتج غير موجود';
    END IF;
    
    IF v_qty > v_current_stock THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المخزون المتوفر (%) للمنتج %', v_qty, v_current_stock, v_product_name;
    END IF;
    
    v_grand_total := v_grand_total + (v_item->>'totalPrice')::NUMERIC;
  END LOOP;
  
  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, auth.uid())
  RETURNING id INTO v_sale_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    v_price := (v_item->>'unitPrice')::NUMERIC;
    
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, v_item->>'productName', v_qty, v_price, (v_item->>'totalPrice')::NUMERIC);
    
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id AND organization_id = v_org_id;
  END LOOP;
  
  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id;
  END IF;
  
  RETURN v_sale_id;
END;
$function$;

-- =============================================
-- 2. Fix create_delivery_rpc: Stock check + fix double quantity
-- =============================================
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(p_distributor_name text, p_items jsonb, p_notes text DEFAULT NULL::text, p_distributor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_delivery_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_current_stock INT;
  v_product_name TEXT;
  v_dist_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  IF p_distributor_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الموزع';
  END IF;
  
  v_dist_id := p_distributor_id;
  
  -- Validate stock BEFORE creating delivery
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    SELECT stock, name INTO v_current_stock, v_product_name
    FROM products WHERE id = v_product_id AND organization_id = v_org_id;
    
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'المنتج غير موجود';
    END IF;
    
    IF v_qty > v_current_stock THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المخزون المتوفر (%) للمنتج %', v_qty, v_current_stock, v_product_name;
    END IF;
  END LOOP;
  
  INSERT INTO deliveries (organization_id, distributor_id, distributor_name, status, notes, created_by)
  VALUES (v_org_id, v_dist_id, p_distributor_name, 'completed', p_notes, auth.uid())
  RETURNING id INTO v_delivery_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    INSERT INTO delivery_items (delivery_id, product_id, product_name, quantity)
    VALUES (v_delivery_id, v_product_id, v_item->>'productName', v_qty);
    
    -- Deduct from main stock
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id AND organization_id = v_org_id;
    
    -- FIXED: Use proper UPSERT to avoid double quantity
    INSERT INTO distributor_inventory (organization_id, distributor_id, product_id, product_name, quantity)
    VALUES (v_org_id, v_dist_id, v_product_id, v_item->>'productName', v_qty)
    ON CONFLICT (organization_id, distributor_id, product_id) 
    DO UPDATE SET quantity = distributor_inventory.quantity + EXCLUDED.quantity, updated_at = now();
  END LOOP;
  
  RETURN v_delivery_id;
END;
$function$;

-- =============================================
-- 3. Fix transfer_to_main_warehouse_rpc: Add stock check
-- =============================================
CREATE OR REPLACE FUNCTION public.transfer_to_main_warehouse_rpc(p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_current_qty INT;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    -- Check distributor has enough quantity
    SELECT quantity INTO v_current_qty 
    FROM distributor_inventory 
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    IF v_current_qty IS NULL OR v_qty > v_current_qty THEN
      RAISE EXCEPTION 'الكمية المطلوبة تتجاوز المتوفر في مخزن الموزع';
    END IF;
    
    -- Deduct from distributor inventory
    UPDATE distributor_inventory 
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    -- Add back to main stock
    UPDATE products SET stock = stock + v_qty WHERE id = v_product_id AND organization_id = v_org_id;
    
    -- Log stock movement
    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, source_type, destination_type, source_id, destination_id, created_by)
    VALUES (v_org_id, v_product_id, v_qty, 'TRANSFER', 'distributor', 'central', v_user_id, NULL, v_user_id);
  END LOOP;
END;
$function$;

-- =============================================
-- 4. Fix create_purchase_return_rpc: Add stock check
-- =============================================
CREATE OR REPLACE FUNCTION public.create_purchase_return_rpc(p_items jsonb, p_reason text DEFAULT NULL::text, p_supplier_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_return_id UUID;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_current_stock INT;
  v_product_name_check TEXT;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- Validate stock BEFORE processing
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT stock, name INTO v_current_stock, v_product_name_check
    FROM products WHERE id = (v_item->>'product_id')::UUID AND organization_id = v_org_id;
    
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'المنتج غير موجود';
    END IF;
    
    IF (v_item->>'quantity')::INT > v_current_stock THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المخزون المتوفر (%) للمنتج %', 
        (v_item->>'quantity')::INT, v_current_stock, v_product_name_check;
    END IF;
    
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  
  INSERT INTO purchase_returns (organization_id, supplier_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_supplier_name, v_total, p_reason, auth.uid())
  RETURNING id INTO v_return_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::INT, (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
    
    UPDATE products SET stock = stock - (v_item->>'quantity')::INT WHERE id = (v_item->>'product_id')::UUID AND organization_id = v_org_id;
  END LOOP;
  
  RETURN v_return_id;
END;
$function$;

-- =============================================
-- 5. Restrict profile updates: prevent role/org escalation
-- =============================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND organization_id IS NOT DISTINCT FROM (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- =============================================
-- 6. Add unique constraint for distributor_inventory UPSERT
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'distributor_inventory_org_dist_product_unique'
  ) THEN
    ALTER TABLE public.distributor_inventory 
    ADD CONSTRAINT distributor_inventory_org_dist_product_unique 
    UNIQUE (organization_id, distributor_id, product_id);
  END IF;
END $$;
