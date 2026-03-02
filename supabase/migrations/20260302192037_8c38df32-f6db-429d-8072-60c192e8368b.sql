-- Enforce TRIAL-only license creation (no more PERMANENT)
CREATE OR REPLACE FUNCTION public.issue_license_rpc(p_org_name text, p_type text, p_days integer, p_max_employees integer DEFAULT 10, p_owner_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_license_key TEXT;
  v_license_id UUID;
  v_org_id UUID;
  v_expiry TIMESTAMPTZ;
  v_actual_type TEXT;
BEGIN
  -- Only developers can issue licenses
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  -- Force type to TRIAL - PERMANENT is no longer allowed
  v_actual_type := 'TRIAL';
  
  -- Create organization
  INSERT INTO organizations (name) VALUES (p_org_name) RETURNING id INTO v_org_id;
  
  -- Generate license key
  v_license_key := 'LIC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  v_expiry := now() + (p_days || ' days')::INTERVAL;
  
  INSERT INTO developer_licenses ("licenseKey", "orgName", type, status, "expiryDate", days_valid, max_employees, owner_phone, organization_id)
  VALUES (v_license_key, p_org_name, v_actual_type, 'READY', v_expiry, p_days, p_max_employees, p_owner_phone, v_org_id)
  RETURNING id INTO v_license_id;
  
  RETURN v_license_id;
END;
$$;

-- Also remove make_license_permanent_rpc since permanent licenses are no longer supported
DROP FUNCTION IF EXISTS public.make_license_permanent_rpc(uuid);