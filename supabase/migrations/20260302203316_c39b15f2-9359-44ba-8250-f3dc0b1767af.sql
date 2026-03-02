
-- Remove orphaned organizations (no longer referenced by developer_licenses)
DELETE FROM organizations WHERE id NOT IN (
  SELECT organization_id FROM profiles WHERE organization_id IS NOT NULL
);
