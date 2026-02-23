-- Seed developer allowlist with existing user email
-- This enables auto-assignment of DEVELOPER role via check_and_assign_developer_role RPC
INSERT INTO public.developer_allowlist (email)
VALUES ('abufuadeid419@gmail.com')
ON CONFLICT DO NOTHING;