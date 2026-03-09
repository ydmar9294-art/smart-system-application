
-- Add statement_timeout to all major RPC functions
ALTER FUNCTION public.void_sale_rpc(uuid, text) SET statement_timeout = '5s';
ALTER FUNCTION public.add_purchase_rpc(uuid, integer, numeric, text, text) SET statement_timeout = '5s';
ALTER FUNCTION public.reverse_payment_rpc(uuid, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_purchase_return_rpc(jsonb, text, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_sales_return_rpc(uuid, jsonb, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_delivery_rpc(text, jsonb, text, uuid) SET statement_timeout = '5s';
ALTER FUNCTION public.create_distributor_sale_rpc(uuid, jsonb, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_distributor_sale_rpc(uuid, jsonb, text, text, numeric, numeric) SET statement_timeout = '5s';
ALTER FUNCTION public.create_distributor_return_rpc(uuid, jsonb, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_sale_rpc(uuid, jsonb, text) SET statement_timeout = '5s';
ALTER FUNCTION public.create_sale_rpc(uuid, jsonb, text, text, numeric, numeric) SET statement_timeout = '5s';
