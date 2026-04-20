-- Performance indexes (safe: IF NOT EXISTS, no schema change)
CREATE INDEX IF NOT EXISTS idx_sales_org_created
  ON public.sales (organization_id, created_at DESC) WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_org_remaining
  ON public.sales (organization_id, customer_id) WHERE remaining > 0 AND is_voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_created_by
  ON public.sales (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_org_name
  ON public.customers (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_org_balance
  ON public.customers (organization_id) WHERE balance > 0;

CREATE INDEX IF NOT EXISTS idx_products_org_active
  ON public.products (organization_id, name) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON public.products (organization_id) WHERE is_deleted = false AND stock <= min_stock;

CREATE INDEX IF NOT EXISTS idx_collections_org_created
  ON public.collections (organization_id, created_at DESC) WHERE is_reversed = false;
CREATE INDEX IF NOT EXISTS idx_collections_sale
  ON public.collections (sale_id);

CREATE INDEX IF NOT EXISTS idx_purchases_org_created
  ON public.purchases (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_returns_org_created
  ON public.sales_returns (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_org_created
  ON public.purchase_returns (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dist_inv_distributor_org
  ON public.distributor_inventory (distributor_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_dist_loc_org_recorded
  ON public.distributor_locations (organization_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dist_loc_user_recorded
  ON public.distributor_locations (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_routes_org_distributor_week
  ON public.routes (organization_id, distributor_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_date_seq
  ON public.route_stops (route_id, planned_date, sequence_order);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_org_created
  ON public.price_change_history (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_date
  ON public.invoice_snapshots (organization_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_org_pair_eff
  ON public.exchange_rates (organization_id, from_currency, to_currency, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_employees_org_unused
  ON public.pending_employees (organization_id) WHERE is_used = false;