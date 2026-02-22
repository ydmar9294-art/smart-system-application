
-- ============================================
-- Performance Indexes for High-Volume Tables
-- ============================================

-- Sales: frequently filtered by organization, customer, date, and voided status
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_voided ON public.sales (organization_id, is_voided) WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales (created_by);

-- Sale Items: frequently joined with sales
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items (product_id);

-- Collections: filtered by sale, organization
CREATE INDEX IF NOT EXISTS idx_collections_sale ON public.collections (sale_id);
CREATE INDEX IF NOT EXISTS idx_collections_org_created ON public.collections (organization_id, created_at DESC);

-- Customers: filtered by organization, sorted by name
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON public.customers (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_org_balance ON public.customers (organization_id, balance) WHERE balance > 0;

-- Products: filtered by organization, deleted status
CREATE INDEX IF NOT EXISTS idx_products_org_active ON public.products (organization_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_org_category ON public.products (organization_id, category);

-- Purchases: filtered by organization, sorted by date
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON public.purchases (organization_id, created_at DESC);

-- Deliveries: filtered by organization, status
CREATE INDEX IF NOT EXISTS idx_deliveries_org_status ON public.deliveries (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_org_created ON public.deliveries (organization_id, created_at DESC);

-- Delivery Items: joined with deliveries
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON public.delivery_items (delivery_id);

-- Stock Movements: filtered by organization, product
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_product ON public.stock_movements (organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_created ON public.stock_movements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements (reference_id);

-- Distributor Inventory: filtered by distributor, organization
CREATE INDEX IF NOT EXISTS idx_dist_inv_distributor ON public.distributor_inventory (distributor_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_dist_inv_product ON public.distributor_inventory (product_id);

-- Pending Employees: filtered by organization, usage status
CREATE INDEX IF NOT EXISTS idx_pending_emp_org_unused ON public.pending_employees (organization_id, is_used) WHERE is_used = false;

-- Sales Returns: filtered by organization
CREATE INDEX IF NOT EXISTS idx_sales_returns_org ON public.sales_returns (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON public.sales_returns (sale_id);

-- Purchase Returns: filtered by organization
CREATE INDEX IF NOT EXISTS idx_purchase_returns_org ON public.purchase_returns (organization_id, created_at DESC);

-- Invoice Snapshots: filtered by organization, type
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_type ON public.invoice_snapshots (organization_id, invoice_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_reference ON public.invoice_snapshots (reference_id);

-- Profiles: filtered by organization
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- Organization Users: lookup by user
CREATE INDEX IF NOT EXISTS idx_org_users_user ON public.organization_users (user_id);

-- User Roles: lookup by user
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);

-- Developer Licenses: lookup by key, owner
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.developer_licenses ("licenseKey");
CREATE INDEX IF NOT EXISTS idx_licenses_owner ON public.developer_licenses ("ownerId");
