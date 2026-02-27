
-- Clean all data except developer profiles and app_versions
-- Order matters due to foreign keys

-- Child tables first
DELETE FROM sales_return_items;
DELETE FROM sales_returns;
DELETE FROM purchase_return_items;
DELETE FROM purchase_returns;
DELETE FROM sale_items;
DELETE FROM collections;
DELETE FROM delivery_items;
DELETE FROM stock_movements;
DELETE FROM distributor_inventory;
DELETE FROM invoice_snapshots;
DELETE FROM user_notifications;
DELETE FROM audit_logs;
DELETE FROM organization_legal_info;

-- Parent tables
DELETE FROM sales;
DELETE FROM customers;
DELETE FROM purchases;
DELETE FROM deliveries;
DELETE FROM products;
DELETE FROM pending_employees;

-- Remove non-developer profiles
DELETE FROM profiles WHERE role != 'DEVELOPER';

-- Licenses and orgs
DELETE FROM developer_licenses;
DELETE FROM organizations;

-- Clean rate limits
DELETE FROM rate_limits;
