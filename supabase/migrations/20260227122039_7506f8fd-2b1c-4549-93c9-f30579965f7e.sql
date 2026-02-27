
-- =============================================
-- 1. AUDIT LOGS TABLE
-- =============================================
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Partition-ready composite indexes
CREATE INDEX idx_audit_logs_org_time ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_time ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own audit logs"
  ON public.audit_logs FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "Developers can read all audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_developer());

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 2. AUDIT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_org_id uuid;
  v_user_id uuid;
  v_entity_id uuid;
  v_details jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_entity_id := NEW.id;
    v_org_id := NEW.organization_id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_entity_id := NEW.id;
    v_org_id := NEW.organization_id;
    -- Only log changed fields
    v_details := jsonb_build_object(
      'changes', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
        FROM jsonb_each(to_jsonb(OLD)) AS o(key, old_val)
        JOIN jsonb_each(to_jsonb(NEW)) AS n(key, new_val) USING (key)
        WHERE old_val IS DISTINCT FROM new_val
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_entity_id := OLD.id;
    v_org_id := OLD.organization_id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_org_id, v_user_id, v_action, TG_TABLE_NAME, v_entity_id, v_details);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================
-- 3. ATTACH TRIGGERS TO SENSITIVE TABLES
-- =============================================
CREATE TRIGGER trg_audit_sales
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_collections
  AFTER INSERT OR UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_sales_returns
  AFTER INSERT ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_developer_licenses
  AFTER INSERT OR UPDATE ON public.developer_licenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- =============================================
-- 4. COMPOSITE INDEXES FOR HIGH-WRITE TABLES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_org_created ON public.collections (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_sale ON public.collections (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers (organization_id);
CREATE INDEX IF NOT EXISTS idx_dist_inv_dist_org ON public.distributor_inventory (distributor_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_time ON public.stock_movements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_org_time ON public.deliveries (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_time ON public.invoice_snapshots (organization_id, created_at DESC);
