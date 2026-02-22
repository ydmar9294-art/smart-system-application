
-- Update create_sale_rpc to save invoice snapshot after creating sale
CREATE OR REPLACE FUNCTION public.create_sale_rpc(p_customer_id uuid, p_items jsonb, p_payment_type text DEFAULT 'CREDIT')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_sale_id UUID;
  v_grand_total NUMERIC := 0;
  v_customer RECORD;
  v_product RECORD;
  v_dist_inv RECORD;
  v_item RECORD;
  v_is_distributor BOOLEAN := false;
  v_paid_amount NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_items_json JSONB;
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
  
  -- Validate items is an array
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Items must be a valid array';
  END IF;
  
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  -- Get customer WITH organization check
  SELECT * INTO v_customer 
  FROM public.customers 
  WHERE id = p_customer_id
  AND organization_id = v_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or access denied';
  END IF;
  
  -- Validate each item and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    IF v_is_distributor THEN
      -- For distributor: check distributor inventory
      SELECT * INTO v_dist_inv
      FROM public.distributor_inventory
      WHERE distributor_id = v_user_id
      AND product_id = v_item.product_id
      FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not in your inventory: %', COALESCE(v_item.product_name, 'Unknown');
      END IF;
      
      IF v_dist_inv.quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock in your inventory for: %. Available: %, Requested: %', 
            v_dist_inv.product_name, v_dist_inv.quantity, v_item.quantity;
      END IF;
    ELSE
      -- For owner: check central stock
      SELECT * INTO v_product 
      FROM public.products 
      WHERE id = v_item.product_id 
      AND organization_id = v_org_id
      FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied: %', COALESCE(v_item.product_name, 'Unknown');
      END IF;
      
      IF v_product.stock < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product: %. Available: %, Requested: %', 
            v_product.name, v_product.stock, v_item.quantity;
      END IF;
    END IF;
    
    v_grand_total := v_grand_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Calculate paid amount based on payment type
  IF p_payment_type = 'CASH' THEN
    v_paid_amount := v_grand_total;
    v_remaining := 0;
  ELSE
    v_paid_amount := 0;
    v_remaining := v_grand_total;
  END IF;
  
  -- Create sale
  INSERT INTO public.sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by)
  VALUES (v_org_id, p_customer_id, v_customer.name, v_grand_total, v_paid_amount, v_remaining, p_payment_type::payment_type, v_user_id)
  RETURNING id INTO v_sale_id;
  
  -- Build items JSON for snapshot
  v_items_json := '[]'::jsonb;
  
  -- Insert items and update appropriate stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    -- Add to items JSON
    v_items_json := v_items_json || jsonb_build_object(
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'total_price', v_item.quantity * v_item.unit_price
    );
    
    IF v_is_distributor THEN
      -- Deduct from distributor inventory
      UPDATE public.distributor_inventory
      SET quantity = quantity - v_item.quantity,
          updated_at = now()
      WHERE distributor_id = v_user_id
      AND product_id = v_item.product_id;
      
      -- Log stock movement: DISTRIBUTOR -> CUSTOMER
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'DISTRIBUTOR', v_user_id,
          'CUSTOMER', p_customer_id, v_item.quantity, 'SALE',
          v_sale_id, v_user_id
      );
    ELSE
      -- Deduct from central stock
      UPDATE public.products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.product_id
      AND organization_id = v_org_id;
      
      -- Log stock movement: CENTRAL -> CUSTOMER
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CENTRAL', NULL,
          'CUSTOMER', p_customer_id, v_item.quantity, 'SALE',
          v_sale_id, v_user_id
      );
    END IF;
  END LOOP;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_remaining
  WHERE id = p_customer_id
  AND organization_id = v_org_id;
  
  -- Save invoice snapshot for history
  PERFORM public.save_invoice_snapshot(
    'sale',
    v_sale_id,
    p_customer_id,
    v_customer.name,
    v_grand_total,
    v_paid_amount,
    v_remaining,
    p_payment_type,
    v_items_json,
    NULL,
    NULL
  );
  
  RETURN v_sale_id;
END;
$$;

-- Update create_sales_return_rpc to save invoice snapshot
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
    
    -- Add to items JSON
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
      
      -- Log stock movement: CUSTOMER -> DISTRIBUTOR (return)
      -- Fixed: Using 'CUSTOMER' as source_type which is now allowed
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
      
      -- Log stock movement: CUSTOMER -> CENTRAL (return)
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

-- Update add_collection_rpc to save invoice snapshot
CREATE OR REPLACE FUNCTION public.add_collection_rpc(p_sale_id uuid, p_amount numeric, p_notes text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_collection_id UUID;
  v_sale RECORD;
  v_customer_name TEXT;
BEGIN
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Get sale WITH organization check and row lock
  SELECT * INTO v_sale 
  FROM public.sales 
  WHERE id = p_sale_id
  AND organization_id = v_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;
  
  IF v_sale.is_voided THEN
    RAISE EXCEPTION 'Cannot add collection to voided sale';
  END IF;
  
  IF p_amount > v_sale.remaining THEN
    RAISE EXCEPTION 'Amount exceeds remaining balance';
  END IF;
  
  v_customer_name := v_sale.customer_name;
  
  -- Create collection
  INSERT INTO public.collections (organization_id, sale_id, amount, notes, collected_by)
  VALUES (v_org_id, p_sale_id, p_amount, NULLIF(trim(COALESCE(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_collection_id;
  
  -- Update sale
  UPDATE public.sales
  SET paid_amount = paid_amount + p_amount,
      remaining = remaining - p_amount
  WHERE id = p_sale_id;
  
  -- Update customer balance with row lock
  UPDATE public.customers
  SET balance = balance - p_amount
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
  
  -- Save invoice snapshot for history
  PERFORM public.save_invoice_snapshot(
    'collection',
    v_collection_id,
    v_sale.customer_id,
    v_customer_name,
    p_amount,
    p_amount,
    0,
    'CASH',
    '[]'::jsonb,
    p_notes,
    NULL
  );
  
  RETURN v_collection_id;
END;
$$;
