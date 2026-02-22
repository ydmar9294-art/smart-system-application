-- Fix: Add distributor organization validation to create_delivery_rpc
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(p_distributor_name text, p_items jsonb, p_notes text DEFAULT NULL::text, p_distributor_id uuid DEFAULT NULL::uuid)
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
    
    -- Validate distributor_id belongs to same organization if provided
    IF p_distributor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = p_distributor_id
            AND organization_id = v_org_id
        ) THEN
            RAISE EXCEPTION 'Distributor does not belong to your organization';
        END IF;
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
    
    -- Create delivery with distributor_id
    INSERT INTO public.deliveries (organization_id, distributor_name, distributor_id, notes, created_by, status)
    VALUES (v_org_id, trim(p_distributor_name), p_distributor_id, NULLIF(trim(COALESCE(p_notes, '')), ''), auth.uid(), 'completed')
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