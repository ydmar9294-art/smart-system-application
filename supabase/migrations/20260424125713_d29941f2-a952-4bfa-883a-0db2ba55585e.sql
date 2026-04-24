
-- ============================================================
-- Migration 1: Remove WAREHOUSE_KEEPER role + Lock prices to OWNER + Auto-notify on price changes
-- ============================================================

-- 1. Convert any existing WAREHOUSE_KEEPER accounts to ACCOUNTANT (closest functional role)
UPDATE public.profiles
SET employee_type = 'ACCOUNTANT', updated_at = now()
WHERE employee_type = 'WAREHOUSE_KEEPER';

UPDATE public.pending_employees
SET employee_type = 'ACCOUNTANT'
WHERE employee_type = 'WAREHOUSE_KEEPER' AND is_used = false;

UPDATE public.account_deletion_requests
SET requester_employee_type = 'ACCOUNTANT'
WHERE requester_employee_type = 'WAREHOUSE_KEEPER';

-- 2. Strengthen products UPDATE policy: only OWNER/DEVELOPER can edit prices/products
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Org members can update products" ON public.products;
DROP POLICY IF EXISTS "Org members can insert products" ON public.products;

-- New: Only OWNER/DEVELOPER can insert/update products
CREATE POLICY "Owners can insert products"
ON public.products
FOR INSERT
TO public
WITH CHECK (
  organization_id = get_my_org_id()
  AND get_my_role() = ANY(ARRAY['OWNER'::text, 'DEVELOPER'::text])
);

CREATE POLICY "Owners can update products"
ON public.products
FOR UPDATE
TO public
USING (
  organization_id = get_my_org_id()
  AND get_my_role() = ANY(ARRAY['OWNER'::text, 'DEVELOPER'::text])
);

-- 3. Trigger: notify all distributors of the org when a product price changes
CREATE OR REPLACE FUNCTION public.notify_distributors_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distributor RECORD;
  v_changed_field TEXT;
  v_old_value NUMERIC;
  v_new_value NUMERIC;
  v_currency TEXT;
BEGIN
  -- Detect what changed
  IF NEW.base_price IS DISTINCT FROM OLD.base_price THEN
    v_changed_field := 'سعر البيع';
    v_old_value := OLD.base_price;
    v_new_value := NEW.base_price;
  ELSIF NEW.consumer_price IS DISTINCT FROM OLD.consumer_price THEN
    v_changed_field := 'سعر المستهلك';
    v_old_value := OLD.consumer_price;
    v_new_value := NEW.consumer_price;
  ELSIF NEW.pricing_currency IS DISTINCT FROM OLD.pricing_currency THEN
    v_changed_field := 'عملة التسعير';
  ELSE
    RETURN NEW; -- No price change
  END IF;

  v_currency := NEW.pricing_currency;

  -- Notify all FIELD_AGENT distributors of the same org
  FOR v_distributor IN
    SELECT id FROM profiles
    WHERE organization_id = NEW.organization_id
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true
  LOOP
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (
      v_distributor.id,
      'تحديث سعر مادة',
      CASE
        WHEN v_old_value IS NOT NULL THEN
          'تم تحديث ' || v_changed_field || ' لـ "' || NEW.name || '" من ' || v_old_value::text || ' إلى ' || v_new_value::text || ' ' || v_currency
        ELSE
          'تم تحديث ' || v_changed_field || ' لـ "' || NEW.name || '"'
      END,
      'price_change',
      jsonb_build_object(
        'product_id', NEW.id,
        'product_name', NEW.name,
        'field', v_changed_field,
        'new_value', v_new_value,
        'currency', v_currency
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_price_change ON public.products;
CREATE TRIGGER trg_notify_price_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  WHEN (
    OLD.base_price IS DISTINCT FROM NEW.base_price
    OR OLD.consumer_price IS DISTINCT FROM NEW.consumer_price
    OR OLD.pricing_currency IS DISTINCT FROM NEW.pricing_currency
  )
  EXECUTE FUNCTION public.notify_distributors_price_change();

-- 4. Trigger: notify on new exchange rate
CREATE OR REPLACE FUNCTION public.notify_distributors_exchange_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distributor RECORD;
BEGIN
  FOR v_distributor IN
    SELECT id FROM profiles
    WHERE organization_id = NEW.organization_id
      AND employee_type = 'FIELD_AGENT'
      AND is_active = true
  LOOP
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (
      v_distributor.id,
      'تحديث سعر الصرف',
      'تم تحديث سعر صرف ' || NEW.from_currency || ' → ' || NEW.to_currency || ' = ' || NEW.rate::text,
      'exchange_rate_change',
      jsonb_build_object(
        'from', NEW.from_currency,
        'to', NEW.to_currency,
        'rate', NEW.rate
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_exchange_rate ON public.exchange_rates;
CREATE TRIGGER trg_notify_exchange_rate
  AFTER INSERT ON public.exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_distributors_exchange_rate();

-- 5. Performance indexes for large product/sales catalogs
CREATE INDEX IF NOT EXISTS idx_products_org_created ON public.products(organization_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON public.products(organization_id, lower(name)) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_distributor_inventory_dist ON public.distributor_inventory(distributor_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread ON public.user_notifications(user_id, is_read, created_at DESC);
