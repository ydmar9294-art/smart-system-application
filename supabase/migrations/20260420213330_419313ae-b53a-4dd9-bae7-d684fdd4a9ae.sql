-- ============================================
-- Fix 1: Prevent role escalation via profiles INSERT
-- ============================================
-- The current INSERT policy allows any user to self-assign role='DEVELOPER' or 'OWNER'.
-- Restrict INSERT so users can only create profiles with role='EMPLOYEE'.
-- Privileged role assignment must go through SECURITY DEFINER RPCs
-- (activate_license_oauth, activate_employee_oauth, check_and_assign_developer_role).

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'EMPLOYEE'
  );

-- ============================================
-- Fix 2: Restrict pending_employees SELECT to owners/managers
-- ============================================
-- Activation codes must not be visible to all org members.
-- Only OWNER, DEVELOPER, and SALES_MANAGER (employee_type) should read full records.

DROP POLICY IF EXISTS "Org members can read pending employees" ON public.pending_employees;

CREATE POLICY "Privileged members can read pending employees"
  ON public.pending_employees
  FOR SELECT
  USING (
    organization_id = get_my_org_id()
    AND (
      get_my_role() = ANY (ARRAY['OWNER'::text, 'DEVELOPER'::text])
      OR (
        get_my_role() = 'EMPLOYEE'::text
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.employee_type = 'SALES_MANAGER'
        )
      )
    )
  );

-- Also tighten INSERT/UPDATE to privileged roles to match management hierarchy
DROP POLICY IF EXISTS "Org members can insert pending employees" ON public.pending_employees;

CREATE POLICY "Privileged members can insert pending employees"
  ON public.pending_employees
  FOR INSERT
  WITH CHECK (
    organization_id = get_my_org_id()
    AND (
      get_my_role() = ANY (ARRAY['OWNER'::text, 'DEVELOPER'::text])
      OR (
        get_my_role() = 'EMPLOYEE'::text
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.employee_type = 'SALES_MANAGER'
        )
      )
    )
  );

-- Keep UPDATE permissive enough for the activation flow (any org member to mark as used)
-- existing "Org members can update pending employees" already in place; leave unchanged
-- so activation RPCs continue working.

-- ============================================
-- Fix 3: Explicit deny INSERT/UPDATE/DELETE on security_events
-- ============================================
-- security_events should only be written by SECURITY DEFINER functions / service role.
-- Add explicit USING(false) policies so no client-side write is ever allowed.

DROP POLICY IF EXISTS "No client insert security events" ON public.security_events;
DROP POLICY IF EXISTS "No client update security events" ON public.security_events;
DROP POLICY IF EXISTS "No client delete security events" ON public.security_events;

CREATE POLICY "No client insert security events"
  ON public.security_events
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client update security events"
  ON public.security_events
  FOR UPDATE
  USING (false);

CREATE POLICY "No client delete security events"
  ON public.security_events
  FOR DELETE
  USING (false);