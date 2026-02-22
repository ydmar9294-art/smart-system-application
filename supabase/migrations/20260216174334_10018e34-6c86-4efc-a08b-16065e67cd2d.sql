-- Enhanced create_sales_return_rpc with return quantity validation
-- Prevents returning more than originally sold minus previous returns
CREATE OR REPLACE FUNCTION public.create_sales_return_rpc(p_sale_id uuid, p_items jsonb, p_reason text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_return_id UUID;
  v_sale RECORD;
  v_item RECORD;
  v_product RECORD;
  v_total NUMERIC := 0;
  v_is_distributor BOOLEAN := false;
  v_items_json JSONB := '[]'::jsonb;
  v_max_quantity INTEGER := 100000;
  v_max_items INTEGER := 100;
  v_sold_qty INTEGER;
  v_already_returned_qty INTEGER;
  v_returnable_qty INTEGER;
BEGIN
  v_user_id := auth.uid();
  v_org_id := public.get_user_organization_id(v_user_id);
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Check if user is distributor
  SELECT employee_type = 'FIELD_AGENT' INTO v_is_distributor
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Validate items
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  IF jsonb_array_length(p_items) > v_max_items THEN
    RAISE EXCEPTION 'Too many items. Maximum % items per return allowed.', v_max_items;
  END IF;
  
  IF p_reason IS NOT NULL AND length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'Reason too long. Maximum 1000 characters.';
  END IF;
  
  -- Get sale with organization check
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  AND organization_id = v_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;
  
  IF v_sale.is_voided THEN
    RAISE EXCEPTION 'Cannot return items from voided sale';
  END IF;
  
  -- Validate items and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.quantity > v_max_quantity THEN
      RAISE EXCEPTION 'Quantity exceeds maximum allowed (%). Item: %', v_max_quantity, COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    IF v_item.unit_price IS NOT NULL AND v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    IF v_item.product_name IS NOT NULL AND length(v_item.product_name) > 255 THEN
      RAISE EXCEPTION 'Product name too long. Maximum 255 characters.';
    END IF;
    
    -- Get originally sold quantity for this product in this sale
    SELECT COALESCE(SUM(si.quantity), 0) INTO v_sold_qty
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
    AND si.product_id = v_item.product_id;
    
    IF v_sold_qty = 0 THEN
      RAISE EXCEPTION 'Product % was not part of this sale', COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    -- Get already returned quantity for this product from previous returns on same sale
    SELECT COALESCE(SUM(sri.quantity), 0) INTO v_already_returned_qty
    FROM public.sales_return_items sri
    JOIN public.sales_returns sr ON sr.id = sri.return_id
    WHERE sr.sale_id = p_sale_id
    AND sri.product_id = v_item.product_id;
    
    v_returnable_qty := v_sold_qty - v_already_returned_qty;
    
    IF v_item.quantity > v_returnable_qty THEN
      RAISE EXCEPTION 'Return quantity (%) exceeds returnable quantity (%) for product %. Already returned: %', 
        v_item.quantity, v_returnable_qty, COALESCE(v_item.product_name, 'Unknown'), v_already_returned_qty;
    END IF;
    
    -- Verify product belongs to organization
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    AND organization_id = v_org_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    v_total := v_total + (v_item.quantity * v_item.unit_price);
    
    v_items_json := v_items_json || jsonb_build_object(
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'total_price', v_item.quantity * v_item.unit_price
    );
  END LOOP;
  
  -- Create sales return
  INSERT INTO public.sales_returns (organization_id, sale_id, customer_id, customer_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_sale_id, v_sale.customer_id, v_sale.customer_name, v_total, NULLIF(trim(COALESCE(p_reason, '')), ''), v_user_id)
  RETURNING id INTO v_return_id;
  
  -- Insert items and update appropriate stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sales_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    IF v_is_distributor THEN
      -- Return stock to distributor inventory
      INSERT INTO public.distributor_inventory (distributor_id, product_id, product_name, quantity, organization_id)
      VALUES (v_user_id, v_item.product_id, v_item.product_name, v_item.quantity, v_org_id)
      ON CONFLICT (distributor_id, product_id)
      DO UPDATE SET 
          quantity = distributor_inventory.quantity + EXCLUDED.quantity,
          updated_at = now();
      
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CUSTOMER', v_sale.customer_id,
          'DISTRIBUTOR', v_user_id, v_item.quantity, 'RETURN',
          v_return_id, v_user_id
      );
    ELSE
      -- Return stock to central inventory
      UPDATE public.products
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id
      AND organization_id = v_org_id;
      
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CUSTOMER', v_sale.customer_id,
          'CENTRAL', NULL, v_item.quantity, 'RETURN',
          v_return_id, v_user_id
      );
    END IF;
  END LOOP;
  
  -- Decrease customer balance
  UPDATE public.customers
  SET balance = balance - v_total
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
  
  -- Save invoice snapshot for history
  PERFORM public.save_invoice_snapshot(
    'return',
    v_return_id,
    v_sale.customer_id,
    v_sale.customer_name,
    v_total,
    0,
    0,
    NULL,
    v_items_json,
    NULL,
    p_reason
  );
  
  RETURN v_return_id;
END;
$$;