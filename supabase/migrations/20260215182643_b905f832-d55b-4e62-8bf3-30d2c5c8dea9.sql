
-- =============================================
-- PHASE 1: DATABASE OPTIMIZATION FOR HIGH LOAD
-- =============================================

-- 1) Mark all RLS helper functions as STABLE for Postgres query planner caching
-- This allows Postgres to cache function results within a single statement/transaction
-- instead of re-executing per-row, dramatically reducing RLS overhead.

CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_employee_type(_user_id uuid, _type employee_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND employee_type = _type
  );
$$;

CREATE OR REPLACE FUNCTION public.is_same_organization(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT organization_id FROM public.profiles WHERE id = _user_id
  ) = (
    SELECT organization_id FROM public.profiles WHERE id = _target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_employee_type(
  p_creator_role user_role,
  p_creator_employee_type employee_type,
  p_target_employee_type employee_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_creator_role = 'OWNER' THEN true
    WHEN p_creator_employee_type = 'SALES_MANAGER' AND p_target_employee_type = 'FIELD_AGENT' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_member_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- 2) Composite indexes for high-frequency dashboard queries
-- These cover the most common RLS + ORDER BY patterns

-- Profile lookups (auth bootstrap, RLS functions)
CREATE INDEX IF NOT EXISTS idx_profiles_id_org_role 
  ON public.profiles (id, organization_id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_org_role 
  ON public.profiles (organization_id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_id_employee_type 
  ON public.profiles (id, employee_type);

-- Sales: org-scoped + time-ordered (dashboard, reports)
CREATE INDEX IF NOT EXISTS idx_sales_org_created 
  ON public.sales (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_org_customer_created 
  ON public.sales (organization_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_org_voided 
  ON public.sales (organization_id, is_voided);

-- Collections: org-scoped + time-ordered
CREATE INDEX IF NOT EXISTS idx_collections_org_created 
  ON public.collections (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_sale_id 
  ON public.collections (sale_id);

-- Products: org-scoped + active filter
CREATE INDEX IF NOT EXISTS idx_products_org_active 
  ON public.products (organization_id, is_deleted, created_at DESC);

-- Customers: org-scoped + time-ordered
CREATE INDEX IF NOT EXISTS idx_customers_org_created 
  ON public.customers (organization_id, created_at DESC);

-- Purchases: org-scoped + time-ordered
CREATE INDEX IF NOT EXISTS idx_purchases_org_created 
  ON public.purchases (organization_id, created_at DESC);

-- Deliveries: org-scoped + status + time
CREATE INDEX IF NOT EXISTS idx_deliveries_org_status_created 
  ON public.deliveries (organization_id, status, created_at DESC);

-- Sale items: sale lookup
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id 
  ON public.sale_items (sale_id);

-- Distributor inventory: org + distributor
CREATE INDEX IF NOT EXISTS idx_dist_inv_org_distributor 
  ON public.distributor_inventory (organization_id, distributor_id);

-- Pending employees: org + unused
CREATE INDEX IF NOT EXISTS idx_pending_emp_org_unused 
  ON public.pending_employees (organization_id, is_used);

-- User roles: fast role lookups (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
  ON public.user_roles (user_id, role);

-- License lookups
CREATE INDEX IF NOT EXISTS idx_licenses_key 
  ON public.developer_licenses ("licenseKey");

CREATE INDEX IF NOT EXISTS idx_licenses_owner 
  ON public.developer_licenses ("ownerId");

-- Stock movements: org-scoped
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_created 
  ON public.stock_movements (organization_id, created_at DESC);

-- Invoice snapshots: org-scoped  
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_created 
  ON public.invoice_snapshots (organization_id, created_at DESC);

-- Sales returns: org-scoped
CREATE INDEX IF NOT EXISTS idx_sales_returns_org_created 
  ON public.sales_returns (organization_id, created_at DESC);

-- Purchase returns: org-scoped
CREATE INDEX IF NOT EXISTS idx_purchase_returns_org_created 
  ON public.purchase_returns (organization_id, created_at DESC);
