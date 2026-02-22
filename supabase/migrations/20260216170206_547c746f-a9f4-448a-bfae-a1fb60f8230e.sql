-- Drop redundant triggers that duplicate the logic already in create_delivery_rpc
-- These triggers cause double inventory increment and duplicate stock movement records

-- 1. Drop trigger that adds to distributor_inventory (RPC already does this)
DROP TRIGGER IF EXISTS trigger_add_distributor_inventory ON public.delivery_items;

-- 2. Drop trigger that logs stock movement (RPC already does this)
DROP TRIGGER IF EXISTS trigger_log_delivery_movement ON public.delivery_items;

-- 3. Drop the now-unused trigger functions
DROP FUNCTION IF EXISTS public.add_distributor_inventory_on_delivery() CASCADE;
DROP FUNCTION IF EXISTS public.log_delivery_stock_movement() CASCADE;