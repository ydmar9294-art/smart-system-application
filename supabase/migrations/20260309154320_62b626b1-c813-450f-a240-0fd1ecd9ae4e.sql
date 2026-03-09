
-- RPC: get_financial_summary_rpc
-- Replaces 6 separate client queries with a single server-side aggregation
CREATE OR REPLACE FUNCTION public.get_financial_summary_rpc()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_org_id uuid;
  v_purchases_total numeric := 0;
  v_sales_returns_total numeric := 0;
  v_purchase_returns_total numeric := 0;
  v_collections_total numeric := 0;
  v_total_discounts numeric := 0;
  v_dist_inventory json;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization found'; END IF;

  SELECT COALESCE(SUM(total_price), 0) INTO v_purchases_total
  FROM purchases WHERE organization_id = v_org_id;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_sales_returns_total
  FROM sales_returns WHERE organization_id = v_org_id;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_purchase_returns_total
  FROM purchase_returns WHERE organization_id = v_org_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_collections_total
  FROM collections WHERE organization_id = v_org_id AND is_reversed = false;

  SELECT COALESCE(SUM(discount_value), 0) INTO v_total_discounts
  FROM sales WHERE organization_id = v_org_id AND is_voided = false;

  SELECT COALESCE(json_agg(json_build_object('product_id', product_id, 'quantity', quantity)), '[]'::json)
  INTO v_dist_inventory
  FROM distributor_inventory WHERE organization_id = v_org_id;

  RETURN json_build_object(
    'purchases_total', v_purchases_total,
    'sales_returns_total', v_sales_returns_total,
    'purchase_returns_total', v_purchase_returns_total,
    'collections_total', v_collections_total,
    'total_discounts', v_total_discounts,
    'distributor_inventory', v_dist_inventory
  );
END;
$$;

-- RPC: get_customer_debts_summary_rpc
-- Aggregates customer debt totals server-side
CREATE OR REPLACE FUNCTION public.get_customer_debts_summary_rpc()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_org_id uuid;
  v_total_debt numeric := 0;
  v_debtor_count integer := 0;
  v_total_collections numeric := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization found'; END IF;

  SELECT COALESCE(SUM(GREATEST(balance, 0)), 0), COUNT(*) FILTER (WHERE balance > 0)
  INTO v_total_debt, v_debtor_count
  FROM customers WHERE organization_id = v_org_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_collections
  FROM collections WHERE organization_id = v_org_id AND is_reversed = false;

  RETURN json_build_object(
    'total_debt', v_total_debt,
    'debtor_count', v_debtor_count,
    'total_collections', v_total_collections
  );
END;
$$;
