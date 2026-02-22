-- Fix deliveries flow: require distributor_id, derive distributor_name from profile
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
AS $function$
DECLARE
    v_org_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_distributor_name TEXT;
BEGIN
    -- Only owners can create deliveries
    IF NOT public.has_role(auth.uid(), 'OWNER') THEN
      RAISE EXCEPTION 'Unauthorized: Only owners can create deliveries';
    END IF;

    -- Get user's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;

    -- Distributor must be a real user (required for inventory isolation)
    IF p_distributor_id IS NULL THEN
      RAISE EXCEPTION 'Distributor is required';
    END IF;

    -- Validate distributor belongs to organization and fetch official name
    SELECT full_name
      INTO v_distributor_name
    FROM public.profiles
    WHERE id = p_distributor_id
      AND organization_id = v_org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Distributor does not belong to your organization';
    END IF;

    -- Validate items is an array
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Items must be a valid array';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;

    -- Validate each item and check organization ownership
    FOR v_item IN
      SELECT *
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
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

    -- Create delivery (use official distributor name)
    INSERT INTO public.deliveries (
      organization_id,
      distributor_name,
      distributor_id,
      notes,
      created_by,
      status
    )
    VALUES (
      v_org_id,
      trim(v_distributor_name),
      p_distributor_id,
      NULLIF(trim(COALESCE(p_notes, '')), ''),
      auth.uid(),
      'completed'
    )
    RETURNING id INTO v_delivery_id;

    -- Insert items and update central stock
    FOR v_item IN
      SELECT *
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);

        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
          AND organization_id = v_org_id;
    END LOOP;

    RETURN v_delivery_id;
END;
$function$;

-- Ensure triggers exist: delivery_items -> distributor_inventory & stock_movements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_add_distributor_inventory') THEN
    CREATE TRIGGER trigger_add_distributor_inventory
    AFTER INSERT ON public.delivery_items
    FOR EACH ROW
    EXECUTE FUNCTION public.add_distributor_inventory_on_delivery();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_delivery_movement') THEN
    CREATE TRIGGER trigger_log_delivery_movement
    AFTER INSERT ON public.delivery_items
    FOR EACH ROW
    EXECUTE FUNCTION public.log_delivery_stock_movement();
  END IF;
END $$;
