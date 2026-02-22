-- Drop the old version of create_delivery_rpc (without p_distributor_id parameter)
DROP FUNCTION IF EXISTS public.create_delivery_rpc(text, jsonb, text);

-- Keep only the new version with p_distributor_id parameter
-- The function signature: create_delivery_rpc(p_distributor_name text, p_items jsonb, p_notes text, p_distributor_id uuid)