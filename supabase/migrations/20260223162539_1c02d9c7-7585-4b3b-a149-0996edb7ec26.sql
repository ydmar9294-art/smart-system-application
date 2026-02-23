
-- Clean all non-developer data (correct FK order)

-- Child tables first
DELETE FROM sale_items;
DELETE FROM delivery_items;
DELETE FROM purchase_return_items;
DELETE FROM sales_return_items;
DELETE FROM collections;
DELETE FROM sales_returns;
DELETE FROM sales;
DELETE FROM purchase_returns;
DELETE FROM purchases;
DELETE FROM deliveries;
DELETE FROM distributor_inventory;
DELETE FROM stock_movements;
DELETE FROM invoice_snapshots;
DELETE FROM pending_employees;
DELETE FROM rate_limits;
DELETE FROM user_notifications;
DELETE FROM organization_legal_info;

-- Non-developer profiles
DELETE FROM profiles WHERE role != 'DEVELOPER';

-- Licenses and orgs
DELETE FROM developer_licenses;
DELETE FROM organizations;
