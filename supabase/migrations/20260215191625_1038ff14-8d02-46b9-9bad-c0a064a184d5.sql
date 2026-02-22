
-- Drop all versions of the function first
DROP FUNCTION IF EXISTS public.activate_employee_oauth(text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.activate_employee_oauth(uuid, text, text, text, text);

-- Recreate single clean version
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(
  p_user_id uuid,
  p_google_id text,
  p_email text,
  p_full_name text,
  p_activation_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending RECORD;
  v_org_id uuid;
  v_result json;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT * INTO v_pending
  FROM public.pending_employees
  WHERE activation_code = p_activation_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'كود التفعيل غير موجود';
  END IF;

  IF v_pending.is_used THEN
    RAISE EXCEPTION 'كود التفعيل مستخدم مسبقاً';
  END IF;

  IF v_pending.expires_at IS NOT NULL AND v_pending.expires_at < now() THEN
    RAISE EXCEPTION 'كود التفعيل منتهي الصلاحية';
  END IF;

  v_org_id := v_pending.organization_id;

  -- Mark code as used
  UPDATE public.pending_employees
  SET is_used = true,
      activated_at = now(),
      activated_by = p_user_id
  WHERE id = v_pending.id;

  -- Create or update profile
  INSERT INTO public.profiles (id, full_name, email, google_id, role, employee_type, organization_id, email_verified)
  VALUES (p_user_id, p_full_name, p_email, p_google_id, v_pending.role, v_pending.employee_type, v_org_id, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    google_id = EXCLUDED.google_id,
    role = EXCLUDED.role,
    employee_type = EXCLUDED.employee_type,
    organization_id = EXCLUDED.organization_id,
    email_verified = true,
    updated_at = now();

  -- Add to organization_users
  INSERT INTO public.organization_users (user_id, organization_id, role)
  VALUES (p_user_id, v_org_id, v_pending.role)
  ON CONFLICT DO NOTHING;

  -- Add to user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_pending.role)
  ON CONFLICT DO NOTHING;

  -- Audit log
  PERFORM public.log_audit_event(
    p_user_id := p_user_id,
    p_action := 'EMPLOYEE_ACTIVATED_OAUTH',
    p_resource_type := 'pending_employee',
    p_resource_id := v_pending.id::text,
    p_organization_id := v_org_id,
    p_severity := 'info',
    p_details := json_build_object('employee_type', v_pending.employee_type, 'role', v_pending.role)::jsonb
  );

  SELECT json_build_object(
    'success', true,
    'role', v_pending.role,
    'employee_type', v_pending.employee_type,
    'organization_id', v_org_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;
