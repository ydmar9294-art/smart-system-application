-- Clean all user/business data, keep developer_allowlist, developer_licenses, app_versions
-- and the organization referenced by developer_licenses

DELETE FROM rate_limits;
DELETE FROM invoice_snapshots;
DELETE FROM user_notifications;
DELETE FROM collections;
DELETE FROM sale_items;
DELETE FROM sales_return_items;
DELETE FROM sales_returns;
DELETE FROM sales;
DELETE FROM purchase_return_items;
DELETE FROM purchase_returns;
DELETE FROM purchases;
DELETE FROM delivery_items;
DELETE FROM deliveries;
DELETE FROM stock_movements;
DELETE FROM distributor_inventory;
DELETE FROM customers;
DELETE FROM products;
DELETE FROM pending_employees;
DELETE FROM organization_legal_info;
DELETE FROM profiles;
DELETE FROM organizations WHERE id NOT IN (SELECT organization_id FROM developer_licenses WHERE organization_id IS NOT NULL);
