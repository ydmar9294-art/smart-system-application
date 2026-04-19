-- ============================================
-- PHASE 0 (retry): WIPE ALL ORG DATA
-- Disable triggers during delete to avoid cascade re-inserts
-- and respect FK order strictly.
-- ============================================

BEGIN;

-- Temporarily disable triggers on all relevant tables to prevent
-- audit/secondary inserts during the wipe.
SET session_replication_role = 'replica';

-- 1) Leaf tables that reference parents (collections + return items + sale items)
DELETE FROM public.collections;
DELETE FROM public.sale_items;
DELETE FROM public.sales_return_items;
DELETE FROM public.purchase_return_items;
DELETE FROM public.delivery_items;
DELETE FROM public.route_stops;

-- 2) Tables that reference sales (must go before sales)
DELETE FROM public.sales_returns;
DELETE FROM public.invoice_snapshots;

-- 3) Now delete sales and other parent transactional tables
DELETE FROM public.sales;
DELETE FROM public.purchases;
DELETE FROM public.purchase_returns;
DELETE FROM public.deliveries;
DELETE FROM public.routes;
DELETE FROM public.visit_plans;

-- 4) Inventory + movement + history
DELETE FROM public.distributor_inventory;
DELETE FROM public.distributor_locations;
DELETE FROM public.stock_movements;
DELETE FROM public.price_change_history;

-- 5) Master data
DELETE FROM public.customers;
DELETE FROM public.products;

-- 6) Governance / audit / notifications
DELETE FROM public.audit_logs;
DELETE FROM public.security_events;
DELETE FROM public.account_deletion_requests;
DELETE FROM public.deletion_requests;
DELETE FROM public.subscription_payments;
DELETE FROM public.pending_employees;
DELETE FROM public.alert_settings;
DELETE FROM public.organization_legal_info;
DELETE FROM public.user_notifications;
DELETE FROM public.user_consents;
DELETE FROM public.devices;
DELETE FROM public.rate_limits;

-- 7) Profiles: keep only developers
DELETE FROM public.profiles
WHERE role IS DISTINCT FROM 'DEVELOPER';

-- 8) Licenses: keep only those whose owner is a remaining developer profile
DELETE FROM public.developer_licenses
WHERE "ownerId" IS NULL
   OR "ownerId" NOT IN (SELECT id FROM public.profiles WHERE role = 'DEVELOPER');

-- 9) Organizations: remove orgs that no longer have any profile
DELETE FROM public.organizations
WHERE id NOT IN (
  SELECT DISTINCT organization_id
  FROM public.profiles
  WHERE organization_id IS NOT NULL
);

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;