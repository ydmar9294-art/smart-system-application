
-- ==========================================
-- SCALABILITY INDEXES FOR 1000+ USERS
-- ==========================================

-- Ensure fast profile lookups by organization
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Fast role lookups for RLS helper functions
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);

-- Organization users composite index
CREATE INDEX IF NOT EXISTS idx_org_users_org_user ON public.organization_users(organization_id, user_id);

-- Products: fast org-scoped queries with soft delete filter
CREATE INDEX IF NOT EXISTS idx_products_org_active ON public.products(organization_id) WHERE is_deleted = false;

-- Customers: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);

-- Sales: fast org-scoped queries with date ordering
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);

-- Sale items: fast join with sales
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- Collections: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_collections_org ON public.collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_sale ON public.collections(sale_id);

-- Purchases: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON public.purchases(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON public.purchases(product_id);

-- Deliveries: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_deliveries_org_created ON public.deliveries(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_distributor ON public.deliveries(distributor_id);

-- Delivery items
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON public.delivery_items(delivery_id);

-- Distributor inventory: fast distributor lookups
CREATE INDEX IF NOT EXISTS idx_dist_inv_distributor ON public.distributor_inventory(distributor_id);
CREATE INDEX IF NOT EXISTS idx_dist_inv_org ON public.distributor_inventory(organization_id);

-- Stock movements: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_created ON public.stock_movements(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);

-- Pending employees: fast org-scoped unused code lookups
CREATE INDEX IF NOT EXISTS idx_pending_emp_org_unused ON public.pending_employees(organization_id) WHERE is_used = false;
CREATE INDEX IF NOT EXISTS idx_pending_emp_code ON public.pending_employees(activation_code) WHERE is_used = false;

-- Sales returns: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_sales_returns_org ON public.sales_returns(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON public.sales_returns(sale_id);

-- Sales return items
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON public.sales_return_items(return_id);

-- Purchase returns
CREATE INDEX IF NOT EXISTS idx_purchase_returns_org ON public.purchase_returns(organization_id, created_at DESC);

-- Purchase return items
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON public.purchase_return_items(return_id);

-- Invoice snapshots: fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_type ON public.invoice_snapshots(organization_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_created_by ON public.invoice_snapshots(created_by);

-- Developer licenses: fast key lookups
CREATE INDEX IF NOT EXISTS idx_dev_licenses_key ON public.developer_licenses("licenseKey");
CREATE INDEX IF NOT EXISTS idx_dev_licenses_owner ON public.developer_licenses("ownerId");

-- Login attempts: fast rate limit checks
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts(ip_hash, attempted_at DESC);

-- AI request logs: fast rate limit checks
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_time ON public.ai_request_logs(user_id, created_at DESC);
