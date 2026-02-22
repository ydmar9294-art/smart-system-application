-- ==========================================
-- SMART SALES SYSTEM - DATABASE SCHEMA
-- ==========================================

-- ENUMS
CREATE TYPE public.user_role AS ENUM ('DEVELOPER', 'OWNER', 'EMPLOYEE');
CREATE TYPE public.employee_type AS ENUM ('FIELD_AGENT', 'ACCOUNTANT');
CREATE TYPE public.license_status AS ENUM ('READY', 'ACTIVE', 'SUSPENDED', 'EXPIRED');
CREATE TYPE public.license_type AS ENUM ('TRIAL', 'PERMANENT');
CREATE TYPE public.payment_type AS ENUM ('CASH', 'CREDIT');

-- ==========================================
-- ORGANIZATIONS TABLE
-- ==========================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES TABLE
-- ==========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role public.user_role NOT NULL DEFAULT 'OWNER',
  employee_type public.employee_type,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  license_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER_ROLES TABLE (Security Best Practice)
-- ==========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DEVELOPER_LICENSES TABLE
-- ==========================================
CREATE TABLE public.developer_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "licenseKey" TEXT NOT NULL UNIQUE,
  "orgName" TEXT NOT NULL,
  type public.license_type NOT NULL DEFAULT 'TRIAL',
  status public.license_status NOT NULL DEFAULT 'READY',
  "ownerId" UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiryDate" TIMESTAMPTZ,
  days_valid INTEGER DEFAULT 30
);

ALTER TABLE public.developer_licenses ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ORGANIZATION_USERS TABLE
-- ==========================================
CREATE TABLE public.organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'OWNER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PRODUCTS TABLE
-- ==========================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CUSTOMERS TABLE
-- ==========================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SALES TABLE
-- ==========================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_type public.payment_type NOT NULL DEFAULT 'CASH',
  is_voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SALE_ITEMS TABLE
-- ==========================================
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- COLLECTIONS (PAYMENTS) TABLE
-- ==========================================
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reverse_reason TEXT,
  collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURITY DEFINER FUNCTIONS
-- ==========================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- Check if developer exists
CREATE OR REPLACE FUNCTION public.developer_exists()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'DEVELOPER'
  )
$$;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Organizations Policies
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Developers can manage organizations"
ON public.organizations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'DEVELOPER'))
WITH CHECK (public.has_role(auth.uid(), 'DEVELOPER'));

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Allow insert for new users"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- User Roles Policies
CREATE POLICY "Developers can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'DEVELOPER'))
WITH CHECK (public.has_role(auth.uid(), 'DEVELOPER'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "First developer can insert their role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND role = 'DEVELOPER' 
  AND NOT public.developer_exists()
);

-- Developer Licenses Policies
CREATE POLICY "Developers can manage licenses"
ON public.developer_licenses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'DEVELOPER'))
WITH CHECK (public.has_role(auth.uid(), 'DEVELOPER'));

CREATE POLICY "Users can view their own license"
ON public.developer_licenses FOR SELECT
TO authenticated
USING ("ownerId" = auth.uid());

-- Organization Users Policies
CREATE POLICY "Users can view org users"
ON public.organization_users FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Owners can manage org users"
ON public.organization_users FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- Products Policies
CREATE POLICY "Users can view products in their org"
ON public.products FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Owners can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- Customers Policies
CREATE POLICY "Users can view customers in their org"
ON public.customers FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Field agents and owners can manage customers"
ON public.customers FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Sales Policies
CREATE POLICY "Users can view sales in their org"
ON public.sales FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Field agents can create sales"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Owners can manage sales"
ON public.sales FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- Sale Items Policies
CREATE POLICY "Users can view sale items"
ON public.sale_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales s 
    WHERE s.id = sale_id 
    AND s.organization_id = public.get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Users can create sale items"
ON public.sale_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s 
    WHERE s.id = sale_id 
    AND s.organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- Collections Policies
CREATE POLICY "Users can view collections in their org"
ON public.collections FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Field agents can create collections"
ON public.collections FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Owners can manage collections"
ON public.collections FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'OWNER')
);

-- ==========================================
-- VIEWS
-- ==========================================

-- Customer Balances View
CREATE OR REPLACE VIEW public.view_customer_balances AS
SELECT 
  c.id,
  c.organization_id,
  c.name,
  c.phone,
  c.balance,
  c.created_at
FROM public.customers c
WHERE c.organization_id = public.get_user_organization_id(auth.uid());

-- Sales Summary View
CREATE OR REPLACE VIEW public.view_sales_summary AS
SELECT 
  s.id,
  s.organization_id,
  s.customer_id,
  s.customer_name,
  s.grand_total,
  s.paid_amount,
  s.remaining,
  s.payment_type,
  s.is_voided,
  s.created_by,
  s.created_at,
  EXTRACT(EPOCH FROM s.created_at) * 1000 AS timestamp
FROM public.sales s
WHERE s.organization_id = public.get_user_organization_id(auth.uid())
OR public.has_role(auth.uid(), 'DEVELOPER');

-- ==========================================
-- HELPER FUNCTIONS (RPC)
-- ==========================================

-- Generate License Key
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Issue License RPC
CREATE OR REPLACE FUNCTION public.issue_license_rpc(
  p_org_name TEXT,
  p_type public.license_type,
  p_days INTEGER DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_id UUID;
  v_key TEXT;
  v_expiry TIMESTAMPTZ;
BEGIN
  -- Only developers can issue licenses
  IF NOT public.has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  v_key := public.generate_license_key();
  
  IF p_type = 'TRIAL' THEN
    v_expiry := now() + (p_days || ' days')::interval;
  ELSE
    v_expiry := NULL;
  END IF;
  
  INSERT INTO public.developer_licenses ("licenseKey", "orgName", type, status, "expiryDate", days_valid)
  VALUES (v_key, p_org_name, p_type, 'READY', v_expiry, p_days)
  RETURNING id INTO v_license_id;
  
  RETURN v_license_id;
END;
$$;

-- Use License RPC (for signup)
CREATE OR REPLACE FUNCTION public.use_license(
  p_user_id UUID,
  p_license_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license RECORD;
  v_org_id UUID;
BEGIN
  -- Find the license
  SELECT * INTO v_license
  FROM public.developer_licenses
  WHERE "licenseKey" = p_license_key
  AND status = 'READY';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'License key not found or already used';
  END IF;
  
  -- Check if expired
  IF v_license."expiryDate" IS NOT NULL AND v_license."expiryDate" < now() THEN
    RAISE EXCEPTION 'License has expired';
  END IF;
  
  -- Create organization
  INSERT INTO public.organizations (name)
  VALUES (v_license."orgName")
  RETURNING id INTO v_org_id;
  
  -- Update profile
  INSERT INTO public.profiles (id, full_name, role, organization_id, license_key)
  VALUES (p_user_id, v_license."orgName", 'OWNER', v_org_id, p_license_key)
  ON CONFLICT (id) DO UPDATE SET
    role = 'OWNER',
    organization_id = v_org_id,
    license_key = p_license_key;
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'OWNER')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link user to org
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'OWNER');
  
  -- Update license
  UPDATE public.developer_licenses
  SET status = 'ACTIVE', "ownerId" = p_user_id
  WHERE id = v_license.id;
END;
$$;

-- Add Employee RPC
CREATE OR REPLACE FUNCTION public.add_employee_rpc(
  p_name TEXT,
  p_phone TEXT,
  p_role public.user_role,
  p_type public.employee_type
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
BEGIN
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Generate activation code
  v_code := 'EMP-' || public.generate_license_key();
  
  -- We store the pending employee info - actual user creation happens on signup
  -- For now, return the code that the owner will give to the employee
  RETURN v_code;
END;
$$;

-- Create Sale RPC
CREATE OR REPLACE FUNCTION public.create_sale_rpc(
  p_customer_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_sale_id UUID;
  v_grand_total NUMERIC := 0;
  v_customer_name TEXT;
  v_item RECORD;
BEGIN
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Get customer name
  SELECT name INTO v_customer_name FROM public.customers WHERE id = p_customer_id;
  
  -- Calculate grand total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, unit_price NUMERIC)
  LOOP
    v_grand_total := v_grand_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Create sale
  INSERT INTO public.sales (organization_id, customer_id, customer_name, grand_total, remaining, created_by)
  VALUES (v_org_id, p_customer_id, COALESCE(v_customer_name, 'Unknown'), v_grand_total, v_grand_total, auth.uid())
  RETURNING id INTO v_sale_id;
  
  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_grand_total
  WHERE id = p_customer_id;
  
  RETURN v_sale_id;
END;
$$;

-- Add Collection RPC
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
  v_collection_id UUID;
  v_sale RECORD;
BEGIN
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Get sale info
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  -- Create collection
  INSERT INTO public.collections (organization_id, sale_id, amount, notes, collected_by)
  VALUES (v_org_id, p_sale_id, p_amount, p_notes, auth.uid())
  RETURNING id INTO v_collection_id;
  
  -- Update sale
  UPDATE public.sales
  SET paid_amount = paid_amount + p_amount,
      remaining = remaining - p_amount
  WHERE id = p_sale_id;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance - p_amount
  WHERE id = v_sale.customer_id;
  
  RETURN v_collection_id;
END;
$$;

-- Void Sale RPC
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
  v_sale RECORD;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  -- Void the sale
  UPDATE public.sales
  SET is_voided = true, void_reason = p_reason
  WHERE id = p_sale_id;
  
  -- Restore customer balance
  UPDATE public.customers
  SET balance = balance - v_sale.remaining
  WHERE id = v_sale.customer_id;
  
  -- Restore stock
  UPDATE public.products p
  SET stock = stock + si.quantity
  FROM public.sale_items si
  WHERE si.sale_id = p_sale_id AND p.id = si.product_id;
END;
$$;

-- Reverse Payment RPC
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
  v_collection RECORD;
  v_sale RECORD;
BEGIN
  SELECT * INTO v_collection FROM public.collections WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  SELECT * INTO v_sale FROM public.sales WHERE id = v_collection.sale_id;
  
  -- Mark as reversed
  UPDATE public.collections
  SET is_reversed = true, reverse_reason = p_reason
  WHERE id = p_payment_id;
  
  -- Update sale
  UPDATE public.sales
  SET paid_amount = paid_amount - v_collection.amount,
      remaining = remaining + v_collection.amount
  WHERE id = v_collection.sale_id;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_collection.amount
  WHERE id = v_sale.customer_id;
END;
$$;