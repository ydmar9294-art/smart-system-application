
-- CLEANUP: Remove all non-developer data
-- Preserve: developer profile, developer_allowlist, developer_licenses, app_versions

-- Notifications & consents
DELETE FROM user_notifications WHERE user_id != '5bf4e190-2b8f-4738-9af9-74902460ebfe';
DELETE FROM user_consents WHERE user_id != '5bf4e190-2b8f-4738-9af9-74902460ebfe';
DELETE FROM account_deletion_requests;
DELETE FROM subscription_payments;
DELETE FROM invoice_snapshots;
DELETE FROM stock_movements;
DELETE FROM sale_items;
DELETE FROM sales_return_items;
DELETE FROM sales_returns;
DELETE FROM collections;
DELETE FROM sales;
DELETE FROM purchase_return_items;
DELETE FROM purchase_returns;
DELETE FROM purchases;
DELETE FROM delivery_items;
DELETE FROM deliveries;
DELETE FROM distributor_inventory;
DELETE FROM customers;
DELETE FROM products;
DELETE FROM pending_employees;
DELETE FROM organization_legal_info;
DELETE FROM devices WHERE user_id != '5bf4e190-2b8f-4738-9af9-74902460ebfe';
DELETE FROM deletion_requests;
DELETE FROM rate_limits;
DELETE FROM audit_logs;
DELETE FROM profiles WHERE id != '5bf4e190-2b8f-4738-9af9-74902460ebfe';

-- Keep orgs referenced by developer_licenses
DELETE FROM organizations WHERE id NOT IN (
  SELECT organization_id FROM profiles 
  WHERE id = '5bf4e190-2b8f-4738-9af9-74902460ebfe' 
  AND organization_id IS NOT NULL
  UNION
  SELECT organization_id FROM developer_licenses 
  WHERE organization_id IS NOT NULL
);
