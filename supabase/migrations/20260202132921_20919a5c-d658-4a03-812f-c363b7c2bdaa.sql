-- Fix trigger function with proper authorization checks
-- This addresses the DEFINER_OR_RPC_BYPASS security issue

CREATE OR REPLACE FUNCTION public.add_distributor_inventory_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_delivery RECORD;
BEGIN
    -- Get delivery with validation
    SELECT * INTO v_delivery 
    FROM public.deliveries 
    WHERE id = NEW.delivery_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery not found';
    END IF;
    
    -- Verify product belongs to same organization as delivery
    IF NOT EXISTS (
        SELECT 1 FROM public.products 
        WHERE id = NEW.product_id 
        AND organization_id = v_delivery.organization_id
    ) THEN
        RAISE EXCEPTION 'Product does not belong to delivery organization';
    END IF;
    
    -- Only process if distributor_id is set
    IF v_delivery.distributor_id IS NOT NULL THEN
        -- Verify distributor belongs to organization
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_delivery.distributor_id
            AND organization_id = v_delivery.organization_id
        ) THEN
            RAISE EXCEPTION 'Distributor does not belong to organization';
        END IF;
        
        -- Now safe to upsert into distributor_inventory
        INSERT INTO public.distributor_inventory (
            distributor_id, 
            product_id, 
            product_name, 
            quantity, 
            organization_id
        )
        VALUES (
            v_delivery.distributor_id,
            NEW.product_id,
            NEW.product_name,
            NEW.quantity,
            v_delivery.organization_id
        )
        ON CONFLICT (distributor_id, product_id)
        DO UPDATE SET 
            quantity = distributor_inventory.quantity + EXCLUDED.quantity,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$function$;