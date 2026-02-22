
-- =============================================
-- 1. AUDIT LOGS TABLE - tracks all sensitive operations
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  organization_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_hash text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Performance indexes for audit logs
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs (organization_id);
CREATE INDEX idx_audit_logs_severity ON public.audit_logs (severity);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

-- RLS for audit logs - strict access
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- No direct client access - only via RPC or service role
CREATE POLICY "Block direct access to audit_logs"
  ON public.audit_logs FOR ALL
  USING (false);

-- Developers can read audit logs
CREATE POLICY "Developers can read audit_logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'DEVELOPER'::user_role));

-- Owners can read their org audit logs
CREATE POLICY "Owners can read org audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'OWNER'::user_role)
  );

-- =============================================
-- 2. AUDIT LOG INSERT FUNCTION (service-level)
-- =============================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_severity text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, organization_id, details, severity)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_organization_id, p_details, p_severity);
END;
$$;

-- =============================================
-- 3. AUTO-AUDIT TRIGGERS for sensitive tables
-- =============================================

-- Audit trigger for sales (create, void)
CREATE OR REPLACE FUNCTION public.audit_sale_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.created_by, 'SALE_CREATED', 'sale', NEW.id::text,
      NEW.organization_id,
      jsonb_build_object('customer_id', NEW.customer_id, 'grand_total', NEW.grand_total, 'payment_type', NEW.payment_type),
      'info'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.is_voided = true AND OLD.is_voided = false THEN
    PERFORM log_audit_event(
      auth.uid(), 'SALE_VOIDED', 'sale', NEW.id::text,
      NEW.organization_id,
      jsonb_build_object('void_reason', NEW.void_reason, 'grand_total', NEW.grand_total),
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_sales_trigger
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.audit_sale_changes();

-- Audit trigger for collections (payments)
CREATE OR REPLACE FUNCTION public.audit_collection_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.collected_by, 'COLLECTION_ADDED', 'collection', NEW.id::text,
      NEW.organization_id,
      jsonb_build_object('sale_id', NEW.sale_id, 'amount', NEW.amount),
      'info'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.is_reversed = true AND OLD.is_reversed = false THEN
    PERFORM log_audit_event(
      auth.uid(), 'COLLECTION_REVERSED', 'collection', NEW.id::text,
      NEW.organization_id,
      jsonb_build_object('amount', NEW.amount, 'reverse_reason', NEW.reverse_reason),
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_collections_trigger
  AFTER INSERT OR UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.audit_collection_changes();

-- Audit trigger for license changes
CREATE OR REPLACE FUNCTION public.audit_license_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NULL, 'LICENSE_ISSUED', 'license', NEW.id::text,
      NULL,
      jsonb_build_object('org_name', NEW."orgName", 'type', NEW.type, 'status', NEW.status),
      'info'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    PERFORM log_audit_event(
      NULL, 'LICENSE_STATUS_CHANGED', 'license', NEW.id::text,
      NULL,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'org_name', NEW."orgName"),
      CASE WHEN NEW.status = 'SUSPENDED' THEN 'critical' ELSE 'warning' END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_licenses_trigger
  AFTER INSERT OR UPDATE ON public.developer_licenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_license_changes();

-- Audit trigger for product stock changes
CREATE OR REPLACE FUNCTION public.audit_product_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false THEN
    PERFORM log_audit_event(
      auth.uid(), 'PRODUCT_DELETED', 'product', NEW.id::text,
      NEW.organization_id,
      jsonb_build_object('name', NEW.name, 'stock', NEW.stock),
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_products_trigger
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_product_changes();

-- =============================================
-- 4. AUTO-CLEANUP: Delete audit logs older than 90 days
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '90 days';
END;
$$;

-- =============================================
-- 5. ENHANCED RATE LIMITING: Per-endpoint tracking
-- =============================================
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_rate_limits_lookup ON public.api_rate_limits (identifier, endpoint, window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to api_rate_limits"
  ON public.api_rate_limits FOR ALL
  USING (false);

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_endpoint_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer DEFAULT 60,
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;
  
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.api_rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;
  
  IF v_count >= p_max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', p_window_seconds);
  END IF;
  
  INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, now());
  
  -- Cleanup old entries
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '5 minutes';
  
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - v_count - 1);
END;
$$;
