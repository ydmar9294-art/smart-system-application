
-- ==========================================
-- SMART SALES SYSTEM - FULL DATABASE SCHEMA
-- ==========================================

-- 1. Organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Profiles (user info linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  employee_type TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  license_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Developer Licenses
CREATE TABLE public.developer_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "licenseKey" TEXT NOT NULL UNIQUE,
  "orgName" TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'TRIAL',
  status TEXT NOT NULL DEFAULT 'READY',
  "ownerId" UUID,
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiryDate" TIMESTAMPTZ,
  days_valid INT,
  max_employees INT NOT NULL DEFAULT 10,
  owner_phone TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.developer_licenses ENABLE ROW LEVEL SECURITY;

-- 4. Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  base_price NUMERIC NOT NULL DEFAULT 0,
  consumer_price NUMERIC NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  phone TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  location TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 6. Sales
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'CASH',
  is_voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 7. Sale Items
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 8. Collections (Payments)
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  sale_id UUID NOT NULL REFERENCES public.sales(id),
  amount NUMERIC NOT NULL,
  notes TEXT,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reverse_reason TEXT,
  collected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- 9. Purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  supplier_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- 10. Deliveries
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  distributor_id UUID,
  distributor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- 11. Delivery Items
CREATE TABLE public.delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- 12. Distributor Inventory
CREATE TABLE public.distributor_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  distributor_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.distributor_inventory ENABLE ROW LEVEL SECURITY;

-- 13. Pending Employees
CREATE TABLE public.pending_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  employee_type TEXT NOT NULL,
  activation_code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  activated_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_employees ENABLE ROW LEVEL SECURITY;

-- 14. Purchase Returns
CREATE TABLE public.purchase_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_name TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;

-- 15. Purchase Return Items
CREATE TABLE public.purchase_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- 16. Developer Allowlist (for auto developer role assignment)
CREATE TABLE public.developer_allowlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.developer_allowlist ENABLE ROW LEVEL SECURITY;

-- 17. Rate Limits
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_products_org ON public.products(organization_id);
CREATE INDEX idx_products_deleted ON public.products(is_deleted);
CREATE INDEX idx_customers_org ON public.customers(organization_id);
CREATE INDEX idx_sales_org ON public.sales(organization_id);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);
CREATE INDEX idx_collections_org ON public.collections(organization_id);
CREATE INDEX idx_collections_sale ON public.collections(sale_id);
CREATE INDEX idx_purchases_org ON public.purchases(organization_id);
CREATE INDEX idx_deliveries_org ON public.deliveries(organization_id);
CREATE INDEX idx_distributor_inv_org ON public.distributor_inventory(organization_id);
CREATE INDEX idx_distributor_inv_dist ON public.distributor_inventory(distributor_id);
CREATE INDEX idx_pending_emp_org ON public.pending_employees(organization_id);
CREATE INDEX idx_pending_emp_code ON public.pending_employees(activation_code);
CREATE INDEX idx_purchase_returns_org ON public.purchase_returns(organization_id);
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(identifier, endpoint);

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Organizations: authenticated users can read their own org
CREATE POLICY "Users can read own org" ON public.organizations FOR SELECT USING (
  id IN (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Developers can read all orgs" ON public.organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);
CREATE POLICY "Developers can insert orgs" ON public.organizations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can read org profiles" ON public.profiles FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Developers can read all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);
CREATE POLICY "Service can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Developers can update profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Products
CREATE POLICY "Org members can read products" ON public.products FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert products" ON public.products FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all products" ON public.products FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Customers
CREATE POLICY "Org members can read customers" ON public.customers FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert customers" ON public.customers FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can update customers" ON public.customers FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all customers" ON public.customers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Sales
CREATE POLICY "Org members can read sales" ON public.sales FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert sales" ON public.sales FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can update sales" ON public.sales FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all sales" ON public.sales FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Sale Items
CREATE POLICY "Org members can read sale items" ON public.sale_items FOR SELECT USING (
  sale_id IN (SELECT id FROM public.sales WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Org members can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (true);

-- Collections
CREATE POLICY "Org members can read collections" ON public.collections FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert collections" ON public.collections FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can update collections" ON public.collections FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all collections" ON public.collections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Purchases
CREATE POLICY "Org members can read purchases" ON public.purchases FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert purchases" ON public.purchases FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all purchases" ON public.purchases FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Deliveries
CREATE POLICY "Org members can read deliveries" ON public.deliveries FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert deliveries" ON public.deliveries FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all deliveries" ON public.deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Delivery Items
CREATE POLICY "Org members can read delivery items" ON public.delivery_items FOR SELECT USING (
  delivery_id IN (SELECT id FROM public.deliveries WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Insert delivery items" ON public.delivery_items FOR INSERT WITH CHECK (true);

-- Distributor Inventory
CREATE POLICY "Org members can read dist inventory" ON public.distributor_inventory FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can manage dist inventory" ON public.distributor_inventory FOR ALL USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all dist inventory" ON public.distributor_inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Pending Employees
CREATE POLICY "Org members can read pending employees" ON public.pending_employees FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert pending employees" ON public.pending_employees FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can update pending employees" ON public.pending_employees FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Purchase Returns
CREATE POLICY "Org members can read purchase returns" ON public.purchase_returns FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert purchase returns" ON public.purchase_returns FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all purchase returns" ON public.purchase_returns FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- Purchase Return Items
CREATE POLICY "Read purchase return items" ON public.purchase_return_items FOR SELECT USING (
  return_id IN (SELECT id FROM public.purchase_returns WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Insert purchase return items" ON public.purchase_return_items FOR INSERT WITH CHECK (true);

-- Developer Licenses
CREATE POLICY "Developers can manage licenses" ON public.developer_licenses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);
CREATE POLICY "Users can read own license" ON public.developer_licenses FOR SELECT USING (
  "licenseKey" IN (SELECT license_key FROM public.profiles WHERE id = auth.uid())
);

-- Developer Allowlist (service role only, no user access)
CREATE POLICY "No direct access to allowlist" ON public.developer_allowlist FOR SELECT USING (false);

-- Rate Limits (service role only)
CREATE POLICY "No direct access to rate limits" ON public.rate_limits FOR SELECT USING (false);

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_endpoint_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INT DEFAULT 60,
  p_window_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Clean old entries and upsert
  DELETE FROM rate_limits WHERE window_start < v_window_start AND identifier = p_identifier AND endpoint = p_endpoint;
  
  INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, now())
  ON CONFLICT (identifier, endpoint)
  DO UPDATE SET 
    request_count = CASE 
      WHEN rate_limits.window_start < v_window_start THEN 1 
      ELSE rate_limits.request_count + 1 
    END,
    window_start = CASE 
      WHEN rate_limits.window_start < v_window_start THEN now() 
      ELSE rate_limits.window_start 
    END
  RETURNING request_count INTO v_count;
  
  RETURN jsonb_build_object('allowed', v_count <= p_max_requests, 'count', v_count);
END;
$$;

-- Check and assign developer role
CREATE OR REPLACE FUNCTION public.check_and_assign_developer_role(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if email is in developer allowlist
  IF EXISTS (SELECT 1 FROM developer_allowlist WHERE email = p_email) THEN
    -- Upsert profile with developer role
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (p_user_id, p_email, p_full_name, 'DEVELOPER')
    ON CONFLICT (id) DO UPDATE SET role = 'DEVELOPER', email = p_email;
  END IF;
END;
$$;

-- Create sale RPC
CREATE OR REPLACE FUNCTION public.create_sale_rpc(
  p_customer_id UUID,
  p_items JSONB,
  p_payment_type TEXT DEFAULT 'CASH'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_customer_name TEXT;
  v_grand_total NUMERIC := 0;
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_price NUMERIC;
BEGIN
  -- Get org from caller profile
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_grand_total := v_grand_total + (v_item->>'totalPrice')::NUMERIC;
  END LOOP;
  
  -- Create sale
  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, auth.uid())
  RETURNING id INTO v_sale_id;
  
  -- Insert items and deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    v_price := (v_item->>'unitPrice')::NUMERIC;
    
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, v_item->>'productName', v_qty, v_price, (v_item->>'totalPrice')::NUMERIC);
    
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id AND organization_id = v_org_id;
  END LOOP;
  
  -- Update customer balance for credit sales
  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id;
  END IF;
  
  RETURN v_sale_id;
END;
$$;

-- Add collection RPC
CREATE OR REPLACE FUNCTION public.add_collection_rpc(
  p_sale_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_remaining NUMERIC;
  v_customer_id UUID;
  v_collection_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT remaining, customer_id INTO v_remaining, v_customer_id FROM sales WHERE id = p_sale_id AND organization_id = v_org_id;
  IF v_remaining IS NULL THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF p_amount > v_remaining THEN RAISE EXCEPTION 'المبلغ أكبر من المتبقي'; END IF;
  
  INSERT INTO collections (organization_id, sale_id, amount, notes, collected_by)
  VALUES (v_org_id, p_sale_id, p_amount, p_notes, auth.uid())
  RETURNING id INTO v_collection_id;
  
  UPDATE sales SET paid_amount = paid_amount + p_amount, remaining = remaining - p_amount WHERE id = p_sale_id;
  UPDATE customers SET balance = balance - p_amount WHERE id = v_customer_id;
  
  RETURN v_collection_id;
END;
$$;

-- Void sale RPC
CREATE OR REPLACE FUNCTION public.void_sale_rpc(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_sale RECORD;
  v_item RECORD;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND organization_id = v_org_id AND is_voided = false;
  IF v_sale IS NULL THEN RAISE EXCEPTION 'الفاتورة غير موجودة أو ملغية'; END IF;
  
  -- Restore stock
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
  END LOOP;
  
  -- Restore customer balance
  UPDATE customers SET balance = balance - v_sale.remaining WHERE id = v_sale.customer_id;
  
  UPDATE sales SET is_voided = true, void_reason = p_reason WHERE id = p_sale_id;
END;
$$;

-- Reverse payment RPC
CREATE OR REPLACE FUNCTION public.reverse_payment_rpc(
  p_payment_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_collection RECORD;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT * INTO v_collection FROM collections WHERE id = p_payment_id AND organization_id = v_org_id AND is_reversed = false;
  IF v_collection IS NULL THEN RAISE EXCEPTION 'الدفعة غير موجودة'; END IF;
  
  UPDATE collections SET is_reversed = true, reverse_reason = p_reason WHERE id = p_payment_id;
  UPDATE sales SET paid_amount = paid_amount - v_collection.amount, remaining = remaining + v_collection.amount WHERE id = v_collection.sale_id;
  
  -- Restore customer balance
  DECLARE v_customer_id UUID;
  BEGIN
    SELECT customer_id INTO v_customer_id FROM sales WHERE id = v_collection.sale_id;
    UPDATE customers SET balance = balance + v_collection.amount WHERE id = v_customer_id;
  END;
END;
$$;

-- Add employee RPC
CREATE OR REPLACE FUNCTION public.add_employee_rpc(
  p_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_license_key TEXT;
  v_max_employees INT;
  v_current_count INT;
BEGIN
  SELECT organization_id, license_key INTO v_org_id, v_license_key FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- Check employee limit
  IF v_license_key IS NOT NULL THEN
    SELECT max_employees INTO v_max_employees FROM developer_licenses WHERE "licenseKey" = v_license_key;
    SELECT COUNT(*) INTO v_current_count FROM profiles WHERE organization_id = v_org_id AND role = 'EMPLOYEE';
    v_current_count := v_current_count + (SELECT COUNT(*) FROM pending_employees WHERE organization_id = v_org_id AND is_used = false);
    IF v_current_count >= COALESCE(v_max_employees, 10) THEN
      RAISE EXCEPTION 'تم الوصول للحد الأقصى من الموظفين';
    END IF;
  END IF;
  
  -- Generate unique activation code
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
  VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());
  
  RETURN v_code;
END;
$$;

-- Issue license RPC
CREATE OR REPLACE FUNCTION public.issue_license_rpc(
  p_org_name TEXT,
  p_type TEXT,
  p_days INT,
  p_max_employees INT DEFAULT 10,
  p_owner_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_key TEXT;
  v_license_id UUID;
  v_org_id UUID;
  v_expiry TIMESTAMPTZ;
BEGIN
  -- Only developers can issue licenses
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  -- Create organization
  INSERT INTO organizations (name) VALUES (p_org_name) RETURNING id INTO v_org_id;
  
  -- Generate license key
  v_license_key := 'LIC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  v_expiry := now() + (p_days || ' days')::INTERVAL;
  
  INSERT INTO developer_licenses ("licenseKey", "orgName", type, status, "expiryDate", days_valid, max_employees, owner_phone, organization_id)
  VALUES (v_license_key, p_org_name, p_type, 'READY', v_expiry, p_days, p_max_employees, p_owner_phone, v_org_id)
  RETURNING id INTO v_license_id;
  
  RETURN v_license_id;
END;
$$;

-- Update license status RPC
CREATE OR REPLACE FUNCTION public.update_license_status_rpc(
  p_license_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  UPDATE developer_licenses SET status = p_status WHERE id = p_license_id;
END;
$$;

-- Make license permanent RPC
CREATE OR REPLACE FUNCTION public.make_license_permanent_rpc(
  p_license_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  UPDATE developer_licenses SET type = 'PERMANENT', "expiryDate" = NULL WHERE id = p_license_id;
END;
$$;

-- Update license max employees RPC
CREATE OR REPLACE FUNCTION public.update_license_max_employees_rpc(
  p_license_id UUID,
  p_max_employees INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_current INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  SELECT organization_id INTO v_org_id FROM developer_licenses WHERE id = p_license_id;
  SELECT COUNT(*) INTO v_current FROM profiles WHERE organization_id = v_org_id AND role = 'EMPLOYEE';
  
  UPDATE developer_licenses SET max_employees = p_max_employees WHERE id = p_license_id;
  
  RETURN jsonb_build_object('current_employees', v_current, 'exceeds_limit', v_current > p_max_employees);
END;
$$;

-- Add purchase RPC
CREATE OR REPLACE FUNCTION public.add_purchase_rpc(
  p_product_id UUID,
  p_quantity INT,
  p_unit_price NUMERIC,
  p_supplier_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_product_name TEXT;
  v_total NUMERIC;
  v_purchase_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT name INTO v_product_name FROM products WHERE id = p_product_id AND organization_id = v_org_id;
  IF v_product_name IS NULL THEN RAISE EXCEPTION 'المنتج غير موجود'; END IF;
  
  v_total := p_quantity * p_unit_price;
  
  INSERT INTO purchases (organization_id, product_id, product_name, quantity, unit_price, total_price, supplier_name, notes, created_by)
  VALUES (v_org_id, p_product_id, v_product_name, p_quantity, p_unit_price, v_total, p_supplier_name, p_notes, auth.uid())
  RETURNING id INTO v_purchase_id;
  
  UPDATE products SET stock = stock + p_quantity WHERE id = p_product_id;
  
  RETURN v_purchase_id;
END;
$$;

-- Create delivery RPC
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
  p_distributor_name TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_distributor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_delivery_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  INSERT INTO deliveries (organization_id, distributor_id, distributor_name, status, notes, created_by)
  VALUES (v_org_id, p_distributor_id, p_distributor_name, 'completed', p_notes, auth.uid())
  RETURNING id INTO v_delivery_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    INSERT INTO delivery_items (delivery_id, product_id, product_name, quantity)
    VALUES (v_delivery_id, v_product_id, v_item->>'productName', v_qty);
    
    -- Deduct from main stock
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id AND organization_id = v_org_id;
    
    -- Add to distributor inventory
    INSERT INTO distributor_inventory (organization_id, distributor_id, product_id, product_name, quantity)
    VALUES (v_org_id, COALESCE(p_distributor_id, gen_random_uuid()), v_product_id, v_item->>'productName', v_qty)
    ON CONFLICT DO NOTHING;
    
    -- If no conflict, update existing
    UPDATE distributor_inventory SET quantity = quantity + v_qty, updated_at = now()
    WHERE organization_id = v_org_id AND distributor_id = COALESCE(p_distributor_id, distributor_id) AND product_id = v_product_id;
  END LOOP;
  
  RETURN v_delivery_id;
END;
$$;

-- Create purchase return RPC
CREATE OR REPLACE FUNCTION public.create_purchase_return_rpc(
  p_items JSONB,
  p_reason TEXT DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_return_id UUID;
  v_item JSONB;
  v_total NUMERIC := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  
  INSERT INTO purchase_returns (organization_id, supplier_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_supplier_name, v_total, p_reason, auth.uid())
  RETURNING id INTO v_return_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::INT, (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
    
    -- Deduct stock
    UPDATE products SET stock = stock - (v_item->>'quantity')::INT WHERE id = (v_item->>'product_id')::UUID AND organization_id = v_org_id;
  END LOOP;
  
  RETURN v_return_id;
END;
$$;

-- Deactivate employee RPC
CREATE OR REPLACE FUNCTION public.deactivate_employee_rpc(
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_target_org UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  SELECT organization_id INTO v_target_org FROM profiles WHERE id = p_employee_id;
  
  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;
  
  UPDATE profiles SET is_active = false WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم تعطيل الموظف بنجاح');
END;
$$;

-- Reactivate employee RPC
CREATE OR REPLACE FUNCTION public.reactivate_employee_rpc(
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_target_org UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  SELECT organization_id INTO v_target_org FROM profiles WHERE id = p_employee_id;
  
  IF v_org_id IS NULL OR v_target_org != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مصرح');
  END IF;
  
  UPDATE profiles SET is_active = true WHERE id = p_employee_id AND organization_id = v_org_id;
  RETURN jsonb_build_object('success', true, 'message', 'تم إعادة تنشيط الموظف بنجاح');
END;
$$;

-- Get organization stats RPC (developer only)
CREATE OR REPLACE FUNCTION public.get_organization_stats_rpc()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  license_id UUID,
  license_status TEXT,
  license_type TEXT,
  max_employees INT,
  expiry_date TIMESTAMPTZ,
  employee_count BIGINT,
  total_users BIGINT,
  pending_employees BIGINT,
  total_sales BIGINT,
  total_products BIGINT,
  total_customers BIGINT,
  total_deliveries BIGINT,
  total_purchases BIGINT,
  total_revenue NUMERIC,
  total_collections NUMERIC,
  total_records BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id AS org_id,
    o.name AS org_name,
    dl.id AS license_id,
    dl.status AS license_status,
    dl.type AS license_type,
    dl.max_employees,
    dl."expiryDate" AS expiry_date,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.role = 'EMPLOYEE')::BIGINT AS employee_count,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id)::BIGINT AS total_users,
    (SELECT COUNT(*) FROM pending_employees pe WHERE pe.organization_id = o.id AND pe.is_used = false)::BIGINT AS pending_employees,
    (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id)::BIGINT AS total_sales,
    (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.is_deleted = false)::BIGINT AS total_products,
    (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)::BIGINT AS total_customers,
    (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id)::BIGINT AS total_deliveries,
    (SELECT COUNT(*) FROM purchases pu WHERE pu.organization_id = o.id)::BIGINT AS total_purchases,
    COALESCE((SELECT SUM(s.grand_total) FROM sales s WHERE s.organization_id = o.id AND s.is_voided = false), 0) AS total_revenue,
    COALESCE((SELECT SUM(col.amount) FROM collections col WHERE col.organization_id = o.id AND col.is_reversed = false), 0) AS total_collections,
    (
      (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id) +
      (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id) +
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)
    )::BIGINT AS total_records
  FROM organizations o
  LEFT JOIN developer_licenses dl ON dl.organization_id = o.id
  ORDER BY o.name;
END;
$$;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_employees;
