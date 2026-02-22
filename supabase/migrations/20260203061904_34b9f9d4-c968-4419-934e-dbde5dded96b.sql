-- Create the trigger for adding items to distributor inventory
CREATE OR REPLACE TRIGGER trigger_add_distributor_inventory
AFTER INSERT ON public.delivery_items
FOR EACH ROW
EXECUTE FUNCTION public.add_distributor_inventory_on_delivery();

-- Add comment for documentation
COMMENT ON TRIGGER trigger_add_distributor_inventory ON public.delivery_items IS 'Automatically adds delivered items to distributor inventory when delivery items are created';