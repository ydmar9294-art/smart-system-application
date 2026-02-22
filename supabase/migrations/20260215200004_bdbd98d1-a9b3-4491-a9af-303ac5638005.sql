DROP FUNCTION IF EXISTS public.create_purchase_return_rpc(jsonb, text, text);

CREATE FUNCTION public.create_purchase_return_rpc(
  p_items jsonb,
  p_reason text DEFAULT NULL,
  p_supplier_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_return_id UUID;
  v_item RECORD;
  v_product RECORD;
  v_total NUMERIC := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'OWNER') 
     AND NOT public.has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and warehouse keepers can create purchase returns';
  END IF;
  
  v_org_id := public.get_user_organization_id(auth.uid());
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    SELECT * INTO v_product FROM public.products
    WHERE id = v_item.product_id AND organization_id = v_org_id FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.product_name, 'Unknown');
    END IF;
    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product: %. Available: %, Requested: %', 
        v_product.name, v_product.stock, v_item.quantity;
    END IF;
    
    v_total := v_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  INSERT INTO public.purchase_returns (organization_id, supplier_name, total_amount, reason, created_by)
  VALUES (v_org_id, NULLIF(trim(COALESCE(p_supplier_name, '')), ''), v_total, NULLIF(trim(COALESCE(p_reason, '')), ''), auth.uid())
  RETURNING id INTO v_return_id;
  
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    UPDATE public.products SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id AND organization_id = v_org_id;
  END LOOP;
  
  RETURN v_return_id;
END;
$$;