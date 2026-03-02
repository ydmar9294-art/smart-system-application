-- Temporarily set Liver food license expiry to 5 days from now to test reminder
-- This is a TEST — we will restore the original value after testing
UPDATE developer_licenses 
SET "expiryDate" = NOW() + INTERVAL '5 days' 
WHERE id = '18c96620-35cc-4fe3-bf4c-4981dc778617';
