
-- Clean developer_licenses and all logs, keep only developer_allowlist and app_versions
DELETE FROM subscription_payments;
DELETE FROM developer_licenses;
DELETE FROM audit_logs;
