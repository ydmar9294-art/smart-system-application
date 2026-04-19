-- ============================================
-- PHASE 1: PERFORMANCE INDEXES + CURRENCY TABLES + PRICING AUTHORITY
-- Additive only. No drops. Backward compatible.
-- ============================================

-- ============================================
-- 1) PERFORMANCE INDEXES
-- (CONCURRENTLY removed because migrations run in a transaction)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_active ON public.sales(organization_id, created_at DESC) WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_collections_org_created ON public.collections(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_sale ON public.collections(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON public.purchases(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distributor_inventory_dist ON public.distributor_inventory(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_locations_user_recorded ON public.distributor_locations(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user_active ON public.devices(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_org_active ON public.products(organization_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profiles_org_role ON public.profiles(organization_id, role) WHERE is_active = true;

-- ============================================
-- 2) RLS HELPER OPTIMIZATION (additive — keep originals)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_org_id_cached()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role_cached()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- 3) PRICING AUTHORITY — Owner-only price edits
-- Trigger blocks non-OWNER/DEVELOPER from changing base_price or consumer_price.
-- Warehouse keepers can still update stock, name, category, min_stock, etc.
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_pricing_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Allow if no price field changed
  IF NEW.base_price IS NOT DISTINCT FROM OLD.base_price
     AND NEW.consumer_price IS NOT DISTINCT FROM OLD.consumer_price
     AND NEW.cost_price IS NOT DISTINCT FROM OLD.cost_price
  THEN
    RETURN NEW;
  END IF;

  -- Skip enforcement for service-role / no auth context (RPC contexts)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('OWNER', 'DEVELOPER') THEN
    RAISE EXCEPTION 'صلاحية تعديل الأسعار مخصصة لمالك المنشأة فقط'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pricing_authority ON public.products;
CREATE TRIGGER trg_enforce_pricing_authority
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pricing_authority();

-- ============================================
-- 4) CURRENCY TABLES
-- ============================================

-- 4a) org_currencies
CREATE TABLE IF NOT EXISTS public.org_currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  currency_code text NOT NULL,
  currency_name_ar text NOT NULL,
  symbol text,
  is_base boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_org_currencies_org ON public.org_currencies(organization_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_currencies_one_base ON public.org_currencies(organization_id) WHERE is_base = true;

ALTER TABLE public.org_currencies ENABLE ROW LEVEL SECURITY;

-- Read for all org members
CREATE POLICY "Org members read currencies"
ON public.org_currencies
FOR SELECT
USING (organization_id = get_my_org_id() OR is_developer());

-- Insert/Update/Delete: Owner or Developer only
CREATE POLICY "Owners insert currencies"
ON public.org_currencies
FOR INSERT
WITH CHECK (
  organization_id = get_my_org_id()
  AND get_my_role() IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "Owners update currencies"
ON public.org_currencies
FOR UPDATE
USING (
  organization_id = get_my_org_id()
  AND get_my_role() IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "Owners delete currencies"
ON public.org_currencies
FOR DELETE
USING (
  organization_id = get_my_org_id()
  AND get_my_role() IN ('OWNER', 'DEVELOPER')
);

-- Enforce max 5 currencies per organization
CREATE OR REPLACE FUNCTION public.enforce_currency_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.org_currencies
  WHERE organization_id = NEW.organization_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'الحد الأقصى للعملات لكل منشأة هو 5 عملات'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_currency_limit ON public.org_currencies;
CREATE TRIGGER trg_enforce_currency_limit
  BEFORE INSERT ON public.org_currencies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_currency_limit();

-- 4b) exchange_rates (immutable history)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(18,6) NOT NULL CHECK (rate > 0),
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_org_effective ON public.exchange_rates(organization_id, from_currency, to_currency, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_org_created ON public.exchange_rates(organization_id, created_at DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Read for all org members
CREATE POLICY "Org members read exchange rates"
ON public.exchange_rates
FOR SELECT
USING (organization_id = get_my_org_id() OR is_developer());

-- Insert: Owner or Developer
CREATE POLICY "Owners insert exchange rates"
ON public.exchange_rates
FOR INSERT
WITH CHECK (
  organization_id = get_my_org_id()
  AND get_my_role() IN ('OWNER', 'DEVELOPER')
);

-- No UPDATE / DELETE policies → immutable

-- ============================================
-- 5) AUTO-SEED DEFAULT CURRENCIES FOR NEW ORGS
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_default_currencies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SYP as base
  INSERT INTO public.org_currencies (organization_id, currency_code, currency_name_ar, symbol, is_base, is_active)
  VALUES (NEW.id, 'SYP', 'ليرة سورية', 'ل.س', true, true)
  ON CONFLICT (organization_id, currency_code) DO NOTHING;

  -- USD as secondary
  INSERT INTO public.org_currencies (organization_id, currency_code, currency_name_ar, symbol, is_base, is_active)
  VALUES (NEW.id, 'USD', 'دولار أمريكي', '$', false, true)
  ON CONFLICT (organization_id, currency_code) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_currencies ON public.organizations;
CREATE TRIGGER trg_seed_default_currencies
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_currencies();

-- ============================================
-- 6) updated_at trigger for org_currencies
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_currencies_touch ON public.org_currencies;
CREATE TRIGGER trg_org_currencies_touch
  BEFORE UPDATE ON public.org_currencies
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();