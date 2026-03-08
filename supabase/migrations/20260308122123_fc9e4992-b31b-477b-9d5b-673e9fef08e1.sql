
-- =============================================
-- Fix: Update create_distributor_sale_rpc to accept discount parameters
-- =============================================
CREATE OR REPLACE FUNCTION public.create_distributor_sale_rpc(
  p_customer_id uuid, 
  p_items jsonb, 
  p_payment_type text DEFAULT 'CASH'::text,
  p_discount_type text DEFAULT NULL,
  p_discount_percentage numeric DEFAULT 0,
  p_discount_value numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_customer_name TEXT;
  v_subtotal NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_price NUMERIC;
  v_current_qty INT;
  v_product_name TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  
  -- Validate stock and calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::UUID, (v_item->>'product_id')::UUID);
    v_qty := (v_item->>'quantity')::INT;
    
    SELECT quantity, product_name INTO v_current_qty, v_product_name
    FROM distributor_inventory 
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    IF v_current_qty IS NULL THEN 
      RAISE EXCEPTION 'المنتج غير موجود في مخزنك';
    END IF;
    
    IF v_qty > v_current_qty THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المتوفر في مخزنك (%) للمنتج %', v_qty, v_current_qty, v_product_name;
    END IF;
    
    v_subtotal := v_subtotal + COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * (v_item->>'unitPrice')::NUMERIC);
  END LOOP;
  
  -- Apply discount
  v_grand_total := GREATEST(0, v_subtotal - COALESCE(p_discount_value, 0));
  
  -- Create sale record with discount
  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by, discount_type, discount_percentage, discount_value)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, v_user_id,
    p_discount_type, COALESCE(p_discount_percentage, 0), COALESCE(p_discount_value, 0))
  RETURNING id INTO v_sale_id;
  
  -- Insert sale items and deduct from DISTRIBUTOR INVENTORY
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::UUID, (v_item->>'product_id')::UUID);
    v_qty := (v_item->>'quantity')::INT;
    v_price := COALESCE((v_item->>'unitPrice')::NUMERIC, (v_item->>'unit_price')::NUMERIC);
    
    SELECT product_name INTO v_product_name FROM distributor_inventory
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, COALESCE(v_product_name, v_item->>'productName'), v_qty, v_price, 
      COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * v_price));
    
    UPDATE distributor_inventory 
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, source_type, source_id, destination_type, destination_id, reference_id, created_by, notes)
    VALUES (v_org_id, v_product_id, v_qty, 'SALE', 'DISTRIBUTOR', v_user_id, 'CUSTOMER', p_customer_id, v_sale_id, v_user_id, 'بيع ميداني');
  END LOOP;
  
  -- Update customer balance for CREDIT sales
  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id AND organization_id = v_org_id;
  END IF;
  
  RETURN v_sale_id;
END;
$function$;

-- =============================================
-- Fix: Update create_sale_rpc to accept discount parameters  
-- =============================================
CREATE OR REPLACE FUNCTION public.create_sale_rpc(
  p_customer_id uuid, 
  p_items jsonb, 
  p_payment_type text DEFAULT 'CASH'::text,
  p_discount_type text DEFAULT NULL,
  p_discount_percentage numeric DEFAULT 0,
  p_discount_value numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_customer_name TEXT;
  v_subtotal NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_price NUMERIC;
  v_current_stock INT;
  v_product_name TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;

  -- Validate items and calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::UUID, (v_item->>'product_id')::UUID);
    v_qty := (v_item->>'quantity')::INT;

    SELECT stock, name INTO v_current_stock, v_product_name FROM products
    WHERE id = v_product_id AND organization_id = v_org_id AND is_deleted = false;

    IF v_current_stock IS NULL THEN RAISE EXCEPTION 'المنتج غير موجود'; END IF;
    IF v_qty > v_current_stock THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المخزون (%) للمنتج %', v_qty, v_current_stock, v_product_name;
    END IF;

    v_subtotal := v_subtotal + COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * (v_item->>'unitPrice')::NUMERIC);
  END LOOP;

  -- Apply discount
  v_grand_total := GREATEST(0, v_subtotal - COALESCE(p_discount_value, 0));

  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by, discount_type, discount_percentage, discount_value)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, v_user_id,
    p_discount_type, COALESCE(p_discount_percentage, 0), COALESCE(p_discount_value, 0))
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::UUID, (v_item->>'product_id')::UUID);
    v_qty := (v_item->>'quantity')::INT;
    v_price := COALESCE((v_item->>'unitPrice')::NUMERIC, (v_item->>'unit_price')::NUMERIC);

    SELECT name INTO v_product_name FROM products WHERE id = v_product_id;

    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, COALESCE(v_product_name, v_item->>'productName'), v_qty, v_price,
      COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * v_price));

    UPDATE products SET stock = stock - v_qty, updated_at = now()
    WHERE id = v_product_id AND organization_id = v_org_id;

    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, source_type, destination_type, destination_id, reference_id, created_by)
    VALUES (v_org_id, v_product_id, v_qty, 'SALE', 'WAREHOUSE', 'CUSTOMER', p_customer_id, v_sale_id, v_user_id);
  END LOOP;

  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id AND organization_id = v_org_id;
  END IF;

  RETURN v_sale_id;
END;
$function$;
