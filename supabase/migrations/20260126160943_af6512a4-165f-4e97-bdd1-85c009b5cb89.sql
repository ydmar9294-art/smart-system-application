-- Create distributor_inventory table to isolate stock per distributor
CREATE TABLE public.distributor_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id uuid NOT NULL,
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT distributor_inventory_quantity_check CHECK (quantity >= 0),
    CONSTRAINT distributor_inventory_unique UNIQUE (distributor_id, product_id)
);

-- Enable RLS
ALTER TABLE public.distributor_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Distributors can view only their own inventory
CREATE POLICY "Distributors can view own inventory"
ON public.distributor_inventory
FOR SELECT
USING (
    (distributor_id = auth.uid() AND organization_id = get_user_organization_id(auth.uid()))
    OR has_role(auth.uid(), 'OWNER')
    OR has_role(auth.uid(), 'DEVELOPER')
);

-- Policy: Only owners can insert/update distributor inventory (when delivering products)
CREATE POLICY "Owners can manage distributor inventory"
ON public.distributor_inventory
FOR ALL
USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'OWNER')
);

-- Policy: Distributors can update their own inventory (when making sales)
CREATE POLICY "Distributors can update own inventory"
ON public.distributor_inventory
FOR UPDATE
USING (
    distributor_id = auth.uid() 
    AND organization_id = get_user_organization_id(auth.uid())
)
WITH CHECK (
    distributor_id = auth.uid() 
    AND organization_id = get_user_organization_id(auth.uid())
);

-- Create function to add inventory to distributor when delivery is made
CREATE OR REPLACE FUNCTION public.add_distributor_inventory_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery RECORD;
    v_item RECORD;
BEGIN
    -- Get delivery info
    SELECT * INTO v_delivery FROM public.deliveries WHERE id = NEW.delivery_id;
    
    -- Only process if distributor_id is set
    IF v_delivery.distributor_id IS NOT NULL THEN
        -- Upsert into distributor_inventory
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
$$;

-- Create trigger to automatically add inventory when delivery items are created
CREATE TRIGGER trigger_add_distributor_inventory
    AFTER INSERT ON public.delivery_items
    FOR EACH ROW
    EXECUTE FUNCTION public.add_distributor_inventory_on_delivery();

-- Enable realtime for distributor_inventory
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_inventory;