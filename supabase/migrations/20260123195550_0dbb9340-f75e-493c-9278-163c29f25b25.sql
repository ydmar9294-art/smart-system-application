-- =====================================================
-- SECURITY FIX MIGRATION
-- Fixes: pending_employees exposure, RPC authorization, 
-- input validation, and race conditions
-- =====================================================

-- =====================================================
-- FIX 1: Remove public access to pending_employees
-- Replace with secure activation flow
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view pending employees for activation" ON public.pending_employees;

-- Add secure policy: only authenticated users can check activation codes
-- This is handled by the activate_employee RPC which is SECURITY DEFINER
-- Users don't need direct table access

-- =====================================================
-- FIX 2-4: Replace all RPC functions with secure versions
-- - Add organization authorization checks
-- - Add input validation
-- - Add row locking for race condition prevention
-- =====================================================

-- REPLACE void_sale_rpc with secure version
CREATE OR REPLACE FUNCTION public.void_sale_rpc(p_sale_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_sale RECORD;
BEGIN
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Void reason is required';
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
    RAISE EXCEPTION 'Sale is already voided';
  END IF;
  
  -- Void the sale
  UPDATE public.sales
  SET is_voided = true, void_reason = trim(p_reason)
  WHERE id = p_sale_id;
  
  -- Restore customer balance
  UPDATE public.customers
  SET balance = balance - v_sale.remaining
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
  
  -- Restore stock (with row locking)
  UPDATE public.products p
  SET stock = stock + si.quantity
  FROM public.sale_items si
  WHERE si.sale_id = p_sale_id 
  AND p.id = si.product_id
  AND p.organization_id = v_org_id;
END;
$function$;

-- REPLACE reverse_payment_rpc with secure version
CREATE OR REPLACE FUNCTION public.reverse_payment_rpc(p_payment_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_collection RECORD;
  v_sale RECORD;
BEGIN
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reverse reason is required';
  END IF;
  
  -- Get collection WITH organization check
  SELECT * INTO v_collection 
  FROM public.collections 
  WHERE id = p_payment_id
  AND organization_id = v_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or access denied';
  END IF;
  
  IF v_collection.is_reversed THEN
    RAISE EXCEPTION 'Payment is already reversed';
  END IF;
  
  -- Get sale WITH organization check
  SELECT * INTO v_sale 
  FROM public.sales 
  WHERE id = v_collection.sale_id
  AND organization_id = v_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;
  
  -- Mark as reversed
  UPDATE public.collections
  SET is_reversed = true, reverse_reason = trim(p_reason)
  WHERE id = p_payment_id;
  
  -- Update sale
  UPDATE public.sales
  SET paid_amount = paid_amount - v_collection.amount,
      remaining = remaining + v_collection.amount
  WHERE id = v_collection.sale_id;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_collection.amount
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
END;
$function$;

-- REPLACE add_collection_rpc with secure version
CREATE OR REPLACE FUNCTION public.add_collection_rpc(p_sale_id uuid, p_amount numeric, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_collection_id UUID;
  v_sale RECORD;
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
  
  RETURN v_collection_id;
END;
$function$;

-- REPLACE add_purchase_rpc with secure version
CREATE OR REPLACE FUNCTION public.add_purchase_rpc(p_product_id uuid, p_quantity integer, p_unit_price numeric, p_supplier_name text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id UUID;
    v_purchase_id UUID;
    v_product RECORD;
BEGIN
    -- Get user's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Validate inputs
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;
    
    IF p_unit_price IS NULL OR p_unit_price < 0 THEN
        RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    -- Get product WITH organization check and row lock
    SELECT * INTO v_product 
    FROM public.products 
    WHERE id = p_product_id
    AND organization_id = v_org_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied';
    END IF;
    
    -- Insert purchase
    INSERT INTO public.purchases (organization_id, product_id, product_name, quantity, unit_price, total_price, supplier_name, notes, created_by)
    VALUES (v_org_id, p_product_id, v_product.name, p_quantity, p_unit_price, p_quantity * p_unit_price, 
            NULLIF(trim(COALESCE(p_supplier_name, '')), ''), 
            NULLIF(trim(COALESCE(p_notes, '')), ''), 
            auth.uid())
    RETURNING id INTO v_purchase_id;
    
    -- Update product stock (increase)
    UPDATE public.products
    SET stock = stock + p_quantity
    WHERE id = p_product_id;
    
    RETURN v_purchase_id;
END;
$function$;

-- REPLACE create_delivery_rpc with secure version
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(p_distributor_name text, p_items jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
    v_product RECORD;
BEGIN
    -- Get user's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Validate distributor name
    IF p_distributor_name IS NULL OR trim(p_distributor_name) = '' THEN
        RAISE EXCEPTION 'Distributor name is required';
    END IF;
    
    -- Validate items is an array
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Items must be a valid array';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;
    
    -- Validate each item and check organization ownership
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be positive for all items';
        END IF;
        
        -- Verify product belongs to organization and has sufficient stock
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
    END LOOP;
    
    -- Create delivery
    INSERT INTO public.deliveries (organization_id, distributor_name, notes, created_by, status)
    VALUES (v_org_id, trim(p_distributor_name), NULLIF(trim(COALESCE(p_notes, '')), ''), auth.uid(), 'completed')
    RETURNING id INTO v_delivery_id;
    
    -- Insert items and update stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);
        
        -- Decrease product stock
        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
        AND organization_id = v_org_id;
    END LOOP;
    
    RETURN v_delivery_id;
END;
$function$;

-- REPLACE create_sale_rpc with secure version
CREATE OR REPLACE FUNCTION public.create_sale_rpc(p_customer_id uuid, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_sale_id UUID;
  v_grand_total NUMERIC := 0;
  v_customer RECORD;
  v_product RECORD;
  v_item RECORD;
BEGIN
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
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
  
  -- Validate each item, check organization ownership, and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    -- Validate item data
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    -- Verify product belongs to organization and has sufficient stock
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
    
    v_grand_total := v_grand_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Create sale
  INSERT INTO public.sales (organization_id, customer_id, customer_name, grand_total, remaining, created_by)
  VALUES (v_org_id, p_customer_id, v_customer.name, v_grand_total, v_grand_total, auth.uid())
  RETURNING id INTO v_sale_id;
  
  -- Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id
    AND organization_id = v_org_id;
  END LOOP;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_grand_total
  WHERE id = p_customer_id
  AND organization_id = v_org_id;
  
  RETURN v_sale_id;
END;
$function$;

-- REPLACE activate_employee with secure version that doesn't need public table access
CREATE OR REPLACE FUNCTION public.activate_employee(p_user_id uuid, p_activation_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_pending RECORD;
BEGIN
    -- Validate activation code format
    IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
        RAISE EXCEPTION 'Activation code is required';
    END IF;
    
    -- Find pending employee (this runs as SECURITY DEFINER, so it can access the table)
    SELECT * INTO v_pending
    FROM public.pending_employees
    WHERE activation_code = trim(p_activation_code) 
    AND is_used = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Activation code not found or already used';
    END IF;
    
    -- Create profile
    INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id)
    VALUES (p_user_id, v_pending.name, v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id)
    ON CONFLICT (id) DO UPDATE SET
        full_name = v_pending.name,
        role = v_pending.role,
        employee_type = v_pending.employee_type,
        organization_id = v_pending.organization_id;
    
    -- Add user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, v_pending.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Link to organization
    INSERT INTO public.organization_users (organization_id, user_id, role)
    VALUES (v_pending.organization_id, p_user_id, v_pending.role)
    ON CONFLICT DO NOTHING;
    
    -- Mark as used
    UPDATE public.pending_employees
    SET is_used = true
    WHERE id = v_pending.id;
END;
$function$;

-- =====================================================
-- FIX 5: Add CHECK constraint for non-negative stock
-- Using trigger instead of CHECK for better control
-- =====================================================

-- Create trigger function to prevent negative stock
CREATE OR REPLACE FUNCTION public.check_stock_non_negative()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative. Current attempt: %', NEW.stock;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on products table
DROP TRIGGER IF EXISTS enforce_stock_non_negative ON public.products;
CREATE TRIGGER enforce_stock_non_negative
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_non_negative();