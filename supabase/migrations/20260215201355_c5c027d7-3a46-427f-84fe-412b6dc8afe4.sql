
-- =====================================================
-- 1. Update create_delivery_rpc to add to distributor_inventory
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
  p_distributor_name text, 
  p_items jsonb, 
  p_notes text DEFAULT NULL::text, 
  p_distributor_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_max_quantity INTEGER := 100000;
    v_max_items INTEGER := 100;
    v_max_name_length INTEGER := 255;
BEGIN
    v_user_id := auth.uid();
    v_org_id := public.get_user_organization_id(v_user_id);
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    IF NOT (
        public.has_role(v_user_id, 'OWNER') OR 
        public.has_employee_type(v_user_id, 'WAREHOUSE_KEEPER')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only owners and warehouse keepers can create deliveries';
    END IF;
    
    IF p_distributor_name IS NULL OR trim(p_distributor_name) = '' THEN
        RAISE EXCEPTION 'Distributor name is required';
    END IF;
    
    IF length(p_distributor_name) > v_max_name_length THEN
        RAISE EXCEPTION 'Distributor name too long. Maximum % characters.', v_max_name_length;
    END IF;
    
    IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
        RAISE EXCEPTION 'Notes too long. Maximum 1000 characters.';
    END IF;
    
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Items must be a valid array';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;
    
    IF jsonb_array_length(p_items) > v_max_items THEN
        RAISE EXCEPTION 'Too many items. Maximum % items per delivery allowed.', v_max_items;
    END IF;
    
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
    
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be positive for all items';
        END IF;
        
        IF v_item.quantity > v_max_quantity THEN
            RAISE EXCEPTION 'Quantity exceeds maximum allowed (%). Item: %', v_max_quantity, COALESCE(v_item.product_name, 'Unknown');
        END IF;
        
        IF v_item.product_name IS NOT NULL AND length(v_item.product_name) > v_max_name_length THEN
            RAISE EXCEPTION 'Product name too long. Maximum % characters.', v_max_name_length;
        END IF;
        
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
    
    INSERT INTO public.deliveries (organization_id, distributor_name, distributor_id, notes, created_by)
    VALUES (v_org_id, trim(p_distributor_name), p_distributor_id, NULLIF(trim(COALESCE(p_notes, '')), ''), v_user_id)
    RETURNING id INTO v_delivery_id;
    
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);
        
        -- Deduct from central stock
        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
        AND organization_id = v_org_id;
        
        -- Add to distributor inventory (if distributor_id provided)
        IF p_distributor_id IS NOT NULL THEN
            INSERT INTO public.distributor_inventory (distributor_id, product_id, product_name, quantity, organization_id)
            VALUES (p_distributor_id, v_item.product_id, v_item.product_name, v_item.quantity, v_org_id)
            ON CONFLICT (distributor_id, product_id)
            DO UPDATE SET 
                quantity = distributor_inventory.quantity + EXCLUDED.quantity,
                updated_at = now();
            
            -- Log stock movement: CENTRAL -> DISTRIBUTOR
            INSERT INTO public.stock_movements (
                organization_id, product_id, source_type, source_id,
                destination_type, destination_id, quantity, movement_type,
                reference_id, created_by
            )
            VALUES (
                v_org_id, v_item.product_id, 'CENTRAL', NULL,
                'DISTRIBUTOR', p_distributor_id, v_item.quantity, 'DELIVERY',
                v_delivery_id, v_user_id
            );
        END IF;
    END LOOP;
    
    RETURN v_delivery_id;
END;
$$;

-- =====================================================
-- 2. Create transfer_to_main_warehouse_rpc
-- =====================================================
CREATE OR REPLACE FUNCTION public.transfer_to_main_warehouse_rpc(
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_item RECORD;
    v_inv RECORD;
    v_transfer_id UUID := gen_random_uuid();
    v_max_items INTEGER := 100;
    v_max_quantity INTEGER := 100000;
BEGIN
    v_user_id := auth.uid();
    v_org_id := public.get_user_organization_id(v_user_id);
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Only FIELD_AGENT (distributors) can transfer back
    IF NOT public.has_employee_type(v_user_id, 'FIELD_AGENT') THEN
        RAISE EXCEPTION 'Unauthorized: Only distributors can transfer stock to main warehouse';
    END IF;
    
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;
    
    IF jsonb_array_length(p_items) > v_max_items THEN
        RAISE EXCEPTION 'Too many items. Maximum % items per transfer.', v_max_items;
    END IF;
    
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be positive for all items';
        END IF;
        
        IF v_item.quantity > v_max_quantity THEN
            RAISE EXCEPTION 'Quantity exceeds maximum allowed';
        END IF;
        
        -- Lock and validate distributor inventory
        SELECT * INTO v_inv
        FROM public.distributor_inventory
        WHERE distributor_id = v_user_id
        AND product_id = v_item.product_id
        AND organization_id = v_org_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found in your inventory';
        END IF;
        
        IF v_inv.quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for: %. Available: %, Requested: %',
                v_inv.product_name, v_inv.quantity, v_item.quantity;
        END IF;
        
        -- Deduct from distributor inventory
        UPDATE public.distributor_inventory
        SET quantity = quantity - v_item.quantity,
            updated_at = now()
        WHERE id = v_inv.id;
        
        -- Add back to central stock
        UPDATE public.products
        SET stock = stock + v_item.quantity
        WHERE id = v_item.product_id
        AND organization_id = v_org_id;
        
        -- Log stock movement: DISTRIBUTOR -> CENTRAL
        INSERT INTO public.stock_movements (
            organization_id, product_id, source_type, source_id,
            destination_type, destination_id, quantity, movement_type,
            reference_id, created_by
        )
        VALUES (
            v_org_id, v_item.product_id, 'DISTRIBUTOR', v_user_id,
            'CENTRAL', NULL, v_item.quantity, 'TRANSFER',
            v_transfer_id, v_user_id
        );
    END LOOP;
    
    RETURN v_transfer_id;
END;
$$;
