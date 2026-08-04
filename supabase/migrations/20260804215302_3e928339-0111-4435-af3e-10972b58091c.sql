DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'calc_pieces','add_purchase_rpc','create_delivery_rpc','confirm_delivery_rpc',
        'reject_delivery_rpc','create_purchase_return_rpc','transfer_to_main_warehouse_rpc',
        'adjust_stock_rpc','archive_product_rpc','restore_product_rpc','create_sale_rpc',
        'apply_stock_movement','adjust_central_stock','adjust_distributor_stock'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, integer, text, text, text, uuid, uuid, uuid, text) FROM authenticated;