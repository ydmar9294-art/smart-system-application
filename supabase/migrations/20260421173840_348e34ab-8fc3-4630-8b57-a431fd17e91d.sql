-- ═══════════════════════════════════════════════════════════════════════════
-- Performance Hardening — Phase 2.1
-- Additive only: no DROP, no RENAME, no schema breaks.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Composite indexes for high-traffic org-scoped lists (DESC ordering matches UI queries)
CREATE INDEX IF NOT EXISTS idx_sales_org_created_desc
  ON public.sales (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_org_created_desc
  ON public.collections (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_org_created_desc
  ON public.purchases (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_desc
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_distributor_locations_org_recorded_desc
  ON public.distributor_locations (organization_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_created_desc
  ON public.invoice_snapshots (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_desc
  ON public.user_notifications (user_id, created_at DESC);

-- 2) Partial indexes for the most common filtered queries

-- Unpaid sales (used by Accountant + Owner financial dashboards)
CREATE INDEX IF NOT EXISTS idx_sales_unpaid_partial
  ON public.sales (organization_id, created_at DESC)
  WHERE remaining > 0 AND is_voided = false;

-- Active distributors per org (used to enforce employee limit + dashboards)
CREATE INDEX IF NOT EXISTS idx_profiles_active_distributors_partial
  ON public.profiles (organization_id)
  WHERE employee_type = 'FIELD_AGENT' AND is_active = true;

-- Active products per org (filter is_deleted = false)
CREATE INDEX IF NOT EXISTS idx_products_active_partial
  ON public.products (organization_id, name)
  WHERE is_deleted = false;

-- Pending account-deletion requests (developer + owner inboxes)
CREATE INDEX IF NOT EXISTS idx_account_deletion_pending_partial
  ON public.account_deletion_requests (organization_id, created_at DESC)
  WHERE status = 'PENDING';

-- Pending subscription payments (developer subscription review queue)
CREATE INDEX IF NOT EXISTS idx_subscription_payments_pending_partial
  ON public.subscription_payments (created_at DESC)
  WHERE status = 'PENDING';

-- Unread notifications per user
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread_partial
  ON public.user_notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- Active devices per user (single-device policy enforcement)
CREATE INDEX IF NOT EXISTS idx_devices_user_active_partial
  ON public.devices (user_id, last_seen DESC)
  WHERE is_active = true;

-- 3) Composite indexes for common JOIN paths
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON public.sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_collections_sale_id
  ON public.collections (sale_id) WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collections_customer_id
  ON public.collections (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distributor_inventory_distributor
  ON public.distributor_inventory (distributor_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_planned
  ON public.route_stops (route_id, planned_date);
