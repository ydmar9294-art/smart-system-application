-- ============================================================
-- HARD REFACTOR: Remove SALES_MANAGER & WAREHOUSE_KEEPER roles
-- ============================================================

-- 1. Force-deactivate any existing legacy accounts (zero exist per audit, defensive)
UPDATE public.profiles
SET is_active = false, updated_at = now()
WHERE employee_type IN ('SALES_MANAGER', 'WAREHOUSE_KEEPER');

-- 2. Mark any unused legacy pending invites as used (block activation)
UPDATE public.pending_employees
SET is_used = true
WHERE employee_type IN ('SALES_MANAGER', 'WAREHOUSE_KEEPER')
  AND is_used = false;

-- 3. Trigger: block any future creation of legacy roles in pending_employees
CREATE OR REPLACE FUNCTION public.block_legacy_employee_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_type IN ('SALES_MANAGER', 'WAREHOUSE_KEEPER') THEN
    RAISE EXCEPTION 'هذا النوع من الحسابات تم إيقافه نهائياً. الأنواع المسموحة فقط: ACCOUNTANT, FIELD_AGENT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_legacy_pending ON public.pending_employees;
CREATE TRIGGER trg_block_legacy_pending
  BEFORE INSERT OR UPDATE ON public.pending_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.block_legacy_employee_types();

-- 4. Trigger: block any future profile insert/update with legacy types
CREATE OR REPLACE FUNCTION public.block_legacy_profile_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_type IN ('SALES_MANAGER', 'WAREHOUSE_KEEPER') THEN
    -- Force deactivate instead of raising (in case of legacy data ingestion)
    NEW.is_active := false;
    NEW.employee_type := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_legacy_profiles ON public.profiles;
CREATE TRIGGER trg_block_legacy_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_legacy_profile_types();

-- 5. Simplify RLS on routes: remove SALES_MANAGER references
DROP POLICY IF EXISTS "Managers can insert routes" ON public.routes;
CREATE POLICY "Owners can insert routes"
  ON public.routes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_my_org_id()
    AND get_my_role() IN ('OWNER', 'DEVELOPER')
  );

DROP POLICY IF EXISTS "Managers can update routes" ON public.routes;
CREATE POLICY "Owners can update routes"
  ON public.routes
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND get_my_role() IN ('OWNER', 'DEVELOPER')
  );

-- 6. Simplify RLS on route_stops
DROP POLICY IF EXISTS "Managers can insert route stops" ON public.route_stops;
CREATE POLICY "Owners can insert route stops"
  ON public.route_stops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    route_id IN (
      SELECT id FROM public.routes
      WHERE organization_id = get_my_org_id()
        AND get_my_role() IN ('OWNER', 'DEVELOPER')
    )
  );

-- 7. Simplify devices RLS: remove SALES_MANAGER manager visibility
DROP POLICY IF EXISTS "Org managers can read org devices" ON public.devices;
CREATE POLICY "Owners can read org devices"
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.organization_id = get_my_org_id()
    )
    AND get_my_role() IN ('OWNER', 'DEVELOPER')
  );

-- 8. Simplify account_deletion_requests RLS
DROP POLICY IF EXISTS "Approvers can update deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Owners can update deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  USING (
    organization_id = get_my_org_id()
    AND status = 'PENDING'
    AND get_my_role() = 'OWNER'
    AND requester_employee_type IN ('FIELD_AGENT', 'ACCOUNTANT')
  );

DROP POLICY IF EXISTS "Owners can read subordinate requests" ON public.account_deletion_requests;
CREATE POLICY "Owners can read all org deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  USING (
    organization_id = get_my_org_id()
    AND get_my_role() = 'OWNER'
    AND requester_employee_type IN ('FIELD_AGENT', 'ACCOUNTANT')
  );

DROP POLICY IF EXISTS "Sales managers can read subordinate requests" ON public.account_deletion_requests;