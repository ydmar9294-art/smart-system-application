
-- =============================================
-- 1. New RPC: create_distributor_sale_rpc
-- Deducts from distributor_inventory instead of products.stock
-- =============================================
CREATE OR REPLACE FUNCTION public.create_distributor_sale_rpc(
  p_customer_id uuid, 
  p_items jsonb, 
  p_payment_type text DEFAULT 'CASH'::text
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
  
  -- Validate stock from DISTRIBUTOR INVENTORY (not main warehouse)
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
    
    v_grand_total := v_grand_total + COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * (v_item->>'unitPrice')::NUMERIC);
  END LOOP;
  
  -- Create sale record
  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, v_user_id)
  RETURNING id INTO v_sale_id;
  
  -- Insert sale items and deduct from DISTRIBUTOR INVENTORY
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::UUID, (v_item->>'product_id')::UUID);
    v_qty := (v_item->>'quantity')::INT;
    v_price := COALESCE((v_item->>'unitPrice')::NUMERIC, (v_item->>'unit_price')::NUMERIC);
    
    -- Get product name from DB
    SELECT product_name INTO v_product_name FROM distributor_inventory
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, COALESCE(v_product_name, v_item->>'productName'), v_qty, v_price, 
      COALESCE((v_item->>'totalPrice')::NUMERIC, v_qty * v_price));
    
    -- Deduct from DISTRIBUTOR inventory (NOT main warehouse)
    UPDATE distributor_inventory 
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
  END LOOP;
  
  -- Update customer balance for credit sales
  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id;
  END IF;
  
  RETURN v_sale_id;
END;
$function$;

-- =============================================
-- 2. New RPC: create_distributor_return_rpc
-- Returns stock to distributor_inventory instead of products.stock
-- =============================================
CREATE OR REPLACE FUNCTION public.create_distributor_return_rpc(
  p_sale_id uuid, 
  p_items jsonb, 
  p_reason text DEFAULT NULL::text
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
  v_return_id UUID;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_customer_id UUID;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT customer_name, customer_id INTO v_customer_name, v_customer_id 
  FROM sales WHERE id = p_sale_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  
  INSERT INTO sales_returns (organization_id, sale_id, customer_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_sale_id, v_customer_name, v_total, p_reason, v_user_id)
  RETURNING id INTO v_return_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sales_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, (v_item->>'product_id')::UUID, v_item->>'product_name', 
      (v_item->>'quantity')::INT, (v_item->>'unit_price')::NUMERIC, 
      (v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
    
    -- Restore stock to DISTRIBUTOR inventory (not main warehouse)
    UPDATE distributor_inventory 
    SET quantity = quantity + (v_item->>'quantity')::INT, updated_at = now()
    WHERE distributor_id = v_user_id 
      AND product_id = (v_item->>'product_id')::UUID 
      AND organization_id = v_org_id;
  END LOOP;
  
  -- Update customer balance
  UPDATE customers SET balance = balance - v_total WHERE id = v_customer_id;
  
  RETURN v_return_id;
END;
$function$;
