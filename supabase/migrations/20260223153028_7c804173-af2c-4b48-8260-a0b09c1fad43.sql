
-- =============================================
-- Fix: Infinite recursion in profiles RLS policies
-- Root cause: profiles policies reference profiles table itself
-- Solution: SECURITY DEFINER helper functions that bypass RLS
-- =============================================

-- 1. Create helper functions (SECURITY DEFINER bypasses RLS)

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER'
  )
$$;

-- =============================================
-- 2. Fix profiles table policies (self-referencing → use helper functions)
-- =============================================

DROP POLICY IF EXISTS "Developers can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Developers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can read org profiles"
  ON public.profiles FOR SELECT
  USING (organization_id = public.get_my_org_id() AND public.get_my_org_id() IS NOT NULL);

CREATE POLICY "Developers can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_developer());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Developers can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_developer());

-- =============================================
-- 3. Fix all dependent table policies that reference profiles
-- =============================================

-- products
DROP POLICY IF EXISTS "Org members can read products" ON public.products;
DROP POLICY IF EXISTS "Org members can insert products" ON public.products;
DROP POLICY IF EXISTS "Org members can update products" ON public.products;
DROP POLICY IF EXISTS "Developers can read all products" ON public.products;

CREATE POLICY "Org members can read products" ON public.products FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert products" ON public.products FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all products" ON public.products FOR SELECT
  USING (public.is_developer());

-- customers
DROP POLICY IF EXISTS "Org members can read customers" ON public.customers;
DROP POLICY IF EXISTS "Org members can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Org members can update customers" ON public.customers;
DROP POLICY IF EXISTS "Developers can read all customers" ON public.customers;

CREATE POLICY "Org members can read customers" ON public.customers FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert customers" ON public.customers FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can update customers" ON public.customers FOR UPDATE
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all customers" ON public.customers FOR SELECT
  USING (public.is_developer());

-- sales
DROP POLICY IF EXISTS "Org members can read sales" ON public.sales;
DROP POLICY IF EXISTS "Org members can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Org members can update sales" ON public.sales;
DROP POLICY IF EXISTS "Developers can read all sales" ON public.sales;

CREATE POLICY "Org members can read sales" ON public.sales FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert sales" ON public.sales FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can update sales" ON public.sales FOR UPDATE
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all sales" ON public.sales FOR SELECT
  USING (public.is_developer());

-- collections
DROP POLICY IF EXISTS "Org members can read collections" ON public.collections;
DROP POLICY IF EXISTS "Org members can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Org members can update collections" ON public.collections;
DROP POLICY IF EXISTS "Developers can read all collections" ON public.collections;

CREATE POLICY "Org members can read collections" ON public.collections FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert collections" ON public.collections FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can update collections" ON public.collections FOR UPDATE
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all collections" ON public.collections FOR SELECT
  USING (public.is_developer());

-- purchases
DROP POLICY IF EXISTS "Org members can read purchases" ON public.purchases;
DROP POLICY IF EXISTS "Org members can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Developers can read all purchases" ON public.purchases;

CREATE POLICY "Org members can read purchases" ON public.purchases FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert purchases" ON public.purchases FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all purchases" ON public.purchases FOR SELECT
  USING (public.is_developer());

-- deliveries
DROP POLICY IF EXISTS "Org members can read deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Org members can insert deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Developers can read all deliveries" ON public.deliveries;

CREATE POLICY "Org members can read deliveries" ON public.deliveries FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert deliveries" ON public.deliveries FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all deliveries" ON public.deliveries FOR SELECT
  USING (public.is_developer());

-- distributor_inventory
DROP POLICY IF EXISTS "Org members can read dist inventory" ON public.distributor_inventory;
DROP POLICY IF EXISTS "Org members can manage dist inventory" ON public.distributor_inventory;
DROP POLICY IF EXISTS "Developers can read all dist inventory" ON public.distributor_inventory;

CREATE POLICY "Org members can read dist inventory" ON public.distributor_inventory FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can manage dist inventory" ON public.distributor_inventory FOR ALL
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all dist inventory" ON public.distributor_inventory FOR SELECT
  USING (public.is_developer());

-- pending_employees
DROP POLICY IF EXISTS "Org members can read pending employees" ON public.pending_employees;
DROP POLICY IF EXISTS "Org members can insert pending employees" ON public.pending_employees;
DROP POLICY IF EXISTS "Org members can update pending employees" ON public.pending_employees;

CREATE POLICY "Org members can read pending employees" ON public.pending_employees FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert pending employees" ON public.pending_employees FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can update pending employees" ON public.pending_employees FOR UPDATE
  USING (organization_id = public.get_my_org_id());

-- purchase_returns
DROP POLICY IF EXISTS "Org members can read purchase returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "Org members can insert purchase returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "Developers can read all purchase returns" ON public.purchase_returns;

CREATE POLICY "Org members can read purchase returns" ON public.purchase_returns FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert purchase returns" ON public.purchase_returns FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all purchase returns" ON public.purchase_returns FOR SELECT
  USING (public.is_developer());

-- sales_returns
DROP POLICY IF EXISTS "Org members can read sales returns" ON public.sales_returns;
DROP POLICY IF EXISTS "Org members can insert sales returns" ON public.sales_returns;
DROP POLICY IF EXISTS "Developers can read all sales returns" ON public.sales_returns;

CREATE POLICY "Org members can read sales returns" ON public.sales_returns FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert sales returns" ON public.sales_returns FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "Developers can read all sales returns" ON public.sales_returns FOR SELECT
  USING (public.is_developer());

-- stock_movements
DROP POLICY IF EXISTS "Org members can read stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Org members can insert stock movements" ON public.stock_movements;

CREATE POLICY "Org members can read stock movements" ON public.stock_movements FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Org members can insert stock movements" ON public.stock_movements FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

-- organizations
DROP POLICY IF EXISTS "Users can read own org" ON public.organizations;
DROP POLICY IF EXISTS "Developers can read all orgs" ON public.organizations;
DROP POLICY IF EXISTS "Developers can insert orgs" ON public.organizations;

CREATE POLICY "Users can read own org" ON public.organizations FOR SELECT
  USING (id = public.get_my_org_id());
CREATE POLICY "Developers can read all orgs" ON public.organizations FOR SELECT
  USING (public.is_developer());
CREATE POLICY "Developers can insert orgs" ON public.organizations FOR INSERT
  WITH CHECK (public.is_developer());

-- developer_licenses
DROP POLICY IF EXISTS "Developers can manage licenses" ON public.developer_licenses;
DROP POLICY IF EXISTS "Users can read own license" ON public.developer_licenses;

CREATE POLICY "Developers can manage licenses" ON public.developer_licenses FOR ALL
  USING (public.is_developer());
CREATE POLICY "Users can read own license" ON public.developer_licenses FOR SELECT
  USING ("licenseKey" IN (
    SELECT license_key FROM public.profiles WHERE id = auth.uid()
  ));

-- organization_legal_info
DROP POLICY IF EXISTS "Org read legal info" ON public.organization_legal_info;
DROP POLICY IF EXISTS "Owner manage legal info" ON public.organization_legal_info;

CREATE POLICY "Org read legal info" ON public.organization_legal_info FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Owner manage legal info" ON public.organization_legal_info FOR ALL
  USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('OWNER', 'DEVELOPER'));

-- sale_items (references sales, which referenced profiles)
DROP POLICY IF EXISTS "Org members can read sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Org members can insert sale items" ON public.sale_items;

CREATE POLICY "Org members can read sale items" ON public.sale_items FOR SELECT
  USING (sale_id IN (SELECT id FROM public.sales WHERE organization_id = public.get_my_org_id()));
CREATE POLICY "Org members can insert sale items" ON public.sale_items FOR INSERT
  WITH CHECK (sale_id IN (SELECT id FROM public.sales WHERE organization_id = public.get_my_org_id()));

-- delivery_items
DROP POLICY IF EXISTS "Org members can read delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Org members can insert delivery items" ON public.delivery_items;

CREATE POLICY "Org members can read delivery items" ON public.delivery_items FOR SELECT
  USING (delivery_id IN (SELECT id FROM public.deliveries WHERE organization_id = public.get_my_org_id()));
CREATE POLICY "Org members can insert delivery items" ON public.delivery_items FOR INSERT
  WITH CHECK (delivery_id IN (SELECT id FROM public.deliveries WHERE organization_id = public.get_my_org_id()));

-- purchase_return_items
DROP POLICY IF EXISTS "Read purchase return items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "Org members can insert purchase return items" ON public.purchase_return_items;

CREATE POLICY "Read purchase return items" ON public.purchase_return_items FOR SELECT
  USING (return_id IN (SELECT id FROM public.purchase_returns WHERE organization_id = public.get_my_org_id()));
CREATE POLICY "Org members can insert purchase return items" ON public.purchase_return_items FOR INSERT
  WITH CHECK (return_id IN (SELECT id FROM public.purchase_returns WHERE organization_id = public.get_my_org_id()));

-- sales_return_items
DROP POLICY IF EXISTS "Org read sales return items" ON public.sales_return_items;
DROP POLICY IF EXISTS "Org insert sales return items" ON public.sales_return_items;

CREATE POLICY "Org read sales return items" ON public.sales_return_items FOR SELECT
  USING (return_id IN (SELECT id FROM public.sales_returns WHERE organization_id = public.get_my_org_id()));
CREATE POLICY "Org insert sales return items" ON public.sales_return_items FOR INSERT
  WITH CHECK (return_id IN (SELECT id FROM public.sales_returns WHERE organization_id = public.get_my_org_id()));

-- invoice_snapshots (keep user-scoped, no recursion issue but fix for consistency)
DROP POLICY IF EXISTS "Users can read own invoice snapshots" ON public.invoice_snapshots;
DROP POLICY IF EXISTS "Users can insert own invoice snapshots" ON public.invoice_snapshots;

CREATE POLICY "Users can read own invoice snapshots" ON public.invoice_snapshots FOR SELECT
  USING (organization_id = public.get_my_org_id());
CREATE POLICY "Users can insert own invoice snapshots" ON public.invoice_snapshots FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());
