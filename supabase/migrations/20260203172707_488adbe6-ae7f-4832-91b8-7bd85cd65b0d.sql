-- =====================================================
-- Security Enhancement: Add bounds checking to RPC functions
-- and create rate limiting table for AI assistant
-- =====================================================

-- Create table for rate limiting AI requests
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

-- Only allow insert via SECURITY DEFINER function
CREATE POLICY "No direct access to ai_request_logs"
ON public.ai_request_logs FOR ALL
USING (false);

-- Create index for efficient rate limit queries
CREATE INDEX idx_ai_request_logs_user_time ON public.ai_request_logs (user_id, created_at DESC);

-- Create function to check and record AI request rate limit
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(p_user_id UUID, p_request_hash TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_max_per_minute INTEGER := 10;
    v_duplicate_count INTEGER := 0;
BEGIN
    -- Count requests in last minute
    SELECT COUNT(*) INTO v_count
    FROM public.ai_request_logs
    WHERE user_id = p_user_id
    AND created_at > now() - interval '1 minute';
    
    -- Check for duplicate requests (spam detection)
    IF p_request_hash IS NOT NULL THEN
        SELECT COUNT(*) INTO v_duplicate_count
        FROM public.ai_request_logs
        WHERE user_id = p_user_id
        AND request_hash = p_request_hash
        AND created_at > now() - interval '5 minutes';
    END IF;
    
    -- If rate limited, return error
    IF v_count >= v_max_per_minute THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'error', 'RATE_LIMITED',
            'message', 'تم تجاوز الحد الأقصى للطلبات. حاول مرة أخرى بعد دقيقة.',
            'retry_after', 60
        );
    END IF;
    
    -- If duplicate spam detected
    IF v_duplicate_count >= 3 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'error', 'DUPLICATE_REQUEST',
            'message', 'تم اكتشاف طلبات مكررة. يرجى الانتظار قبل إعادة المحاولة.'
        );
    END IF;
    
    -- Record the request
    INSERT INTO public.ai_request_logs (user_id, request_hash)
    VALUES (p_user_id, p_request_hash);
    
    -- Cleanup old logs (older than 1 hour)
    DELETE FROM public.ai_request_logs WHERE created_at < now() - interval '1 hour';
    
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', v_max_per_minute - v_count - 1
    );
END;
$$;

-- =====================================================
-- Enhanced validation for create_sale_rpc
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_sale_rpc(p_customer_id uuid, p_items jsonb, p_payment_type text DEFAULT 'CREDIT'::text)
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
  -- Bounds checking constants
  v_max_quantity INTEGER := 100000;
  v_max_unit_price NUMERIC := 1000000000;
  v_max_items INTEGER := 100;
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
  
  -- BOUNDS CHECK: Maximum items per sale
  IF jsonb_array_length(p_items) > v_max_items THEN
    RAISE EXCEPTION 'Too many items. Maximum % items per sale allowed.', v_max_items;
  END IF;
  
  -- Validate payment_type
  IF p_payment_type NOT IN ('CASH', 'CREDIT') THEN
    RAISE EXCEPTION 'Invalid payment type. Must be CASH or CREDIT.';
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
    -- BOUNDS CHECK: Validate quantity
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.quantity > v_max_quantity THEN
      RAISE EXCEPTION 'Quantity exceeds maximum allowed (%). Item: %', v_max_quantity, COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    -- BOUNDS CHECK: Validate unit_price
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    IF v_item.unit_price > v_max_unit_price THEN
      RAISE EXCEPTION 'Unit price exceeds maximum allowed (%). Item: %', v_max_unit_price, COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    -- BOUNDS CHECK: Validate product_name length
    IF v_item.product_name IS NOT NULL AND length(v_item.product_name) > 255 THEN
      RAISE EXCEPTION 'Product name too long. Maximum 255 characters.';
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
  
  -- BOUNDS CHECK: Validate total doesn't overflow
  IF v_grand_total > 9999999999999.99 THEN
    RAISE EXCEPTION 'Grand total exceeds maximum allowed value';
  END IF;
  
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

-- =====================================================
-- Enhanced validation for create_delivery_rpc
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
    p_distributor_name TEXT,
    p_items JSONB,
    p_notes TEXT DEFAULT NULL,
    p_distributor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
    v_product RECORD;
    -- Bounds checking constants
    v_max_quantity INTEGER := 100000;
    v_max_items INTEGER := 100;
    v_max_name_length INTEGER := 255;
BEGIN
    v_user_id := auth.uid();
    v_org_id := public.get_user_organization_id(v_user_id);
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Only OWNER and WAREHOUSE_KEEPER can create deliveries
    IF NOT (
        public.has_role(v_user_id, 'OWNER') OR 
        public.has_employee_type(v_user_id, 'WAREHOUSE_KEEPER')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only owners and warehouse keepers can create deliveries';
    END IF;
    
    -- BOUNDS CHECK: Validate distributor_name
    IF p_distributor_name IS NULL OR trim(p_distributor_name) = '' THEN
        RAISE EXCEPTION 'Distributor name is required';
    END IF;
    
    IF length(p_distributor_name) > v_max_name_length THEN
        RAISE EXCEPTION 'Distributor name too long. Maximum % characters.', v_max_name_length;
    END IF;
    
    -- BOUNDS CHECK: Validate notes length
    IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
        RAISE EXCEPTION 'Notes too long. Maximum 1000 characters.';
    END IF;
    
    -- Validate items
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Items must be a valid array';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;
    
    -- BOUNDS CHECK: Maximum items per delivery
    IF jsonb_array_length(p_items) > v_max_items THEN
        RAISE EXCEPTION 'Too many items. Maximum % items per delivery allowed.', v_max_items;
    END IF;
    
    -- If distributor_id provided, verify they belong to the organization
    IF p_distributor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = p_distributor_id
            AND organization_id = v_org_id
            AND employee_type = 'FIELD_AGENT'
        ) THEN
            RAISE EXCEPTION 'Distributor not found or not a field agent in this organization';
        END IF;
    END IF;
    
    -- Validate items and check stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        -- BOUNDS CHECK: Validate quantity
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be positive for all items';
        END IF;
        
        IF v_item.quantity > v_max_quantity THEN
            RAISE EXCEPTION 'Quantity exceeds maximum allowed (%). Item: %', v_max_quantity, COALESCE(v_item.product_name, 'Unknown');
        END IF;
        
        -- BOUNDS CHECK: Validate product_name length
        IF v_item.product_name IS NOT NULL AND length(v_item.product_name) > v_max_name_length THEN
            RAISE EXCEPTION 'Product name too long. Maximum % characters.', v_max_name_length;
        END IF;
        
        -- Verify product exists and has enough stock
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        AND organization_id = v_org_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.product_name, 'Unknown');
        END IF;
        
        IF v_product.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for: %. Available: %, Requested: %', 
                v_product.name, v_product.stock, v_item.quantity;
        END IF;
    END LOOP;
    
    -- Create delivery
    INSERT INTO public.deliveries (organization_id, distributor_name, distributor_id, notes, created_by)
    VALUES (v_org_id, trim(p_distributor_name), p_distributor_id, NULLIF(trim(COALESCE(p_notes, '')), ''), v_user_id)
    RETURNING id INTO v_delivery_id;
    
    -- Insert delivery items and update stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);
        
        -- Deduct from central stock
        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
        AND organization_id = v_org_id;
    END LOOP;
    
    RETURN v_delivery_id;
END;
$$;

-- =====================================================
-- Enhanced validation for create_sales_return_rpc
-- =====================================================
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
  -- Bounds checking constants
  v_max_quantity INTEGER := 100000;
  v_max_items INTEGER := 100;
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
  
  -- BOUNDS CHECK: Maximum items per return
  IF jsonb_array_length(p_items) > v_max_items THEN
    RAISE EXCEPTION 'Too many items. Maximum % items per return allowed.', v_max_items;
  END IF;
  
  -- BOUNDS CHECK: Validate reason length
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
    -- BOUNDS CHECK: Validate quantity
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.quantity > v_max_quantity THEN
      RAISE EXCEPTION 'Quantity exceeds maximum allowed (%). Item: %', v_max_quantity, COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    -- BOUNDS CHECK: Validate unit_price
    IF v_item.unit_price IS NOT NULL AND v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    -- BOUNDS CHECK: Validate product_name length
    IF v_item.product_name IS NOT NULL AND length(v_item.product_name) > 255 THEN
      RAISE EXCEPTION 'Product name too long. Maximum 255 characters.';
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