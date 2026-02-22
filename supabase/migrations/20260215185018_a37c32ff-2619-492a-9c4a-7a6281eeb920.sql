
-- Add activation audit columns
ALTER TABLE public.pending_employees 
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS activated_by UUID DEFAULT NULL;

-- Fix activate_employee (non-OAuth) - add FOR UPDATE lock
CREATE OR REPLACE FUNCTION public.activate_employee(p_activation_code TEXT, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending RECORD;
BEGIN
    IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
        RAISE EXCEPTION 'Activation code is required';
    END IF;
    
    -- FOR UPDATE prevents concurrent activation race condition
    SELECT * INTO v_pending
    FROM public.pending_employees
    WHERE activation_code = trim(p_activation_code) 
    AND is_used = false
    AND (expires_at IS NULL OR expires_at > now())
    FOR UPDATE;
    
    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND is_used = true) THEN
            RAISE EXCEPTION 'Activation code already used';
        END IF;
        IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND expires_at <= now()) THEN
            RAISE EXCEPTION 'Activation code has expired';
        END IF;
        RAISE EXCEPTION 'Activation code not found or already used';
    END IF;
    
    INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id)
    VALUES (p_user_id, v_pending.name, v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id)
    ON CONFLICT (id) DO UPDATE SET
        full_name = v_pending.name,
        role = v_pending.role,
        employee_type = v_pending.employee_type,
        organization_id = v_pending.organization_id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, v_pending.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.organization_users (organization_id, user_id, role)
    VALUES (v_pending.organization_id, p_user_id, v_pending.role)
    ON CONFLICT DO NOTHING;
    
    -- Mark as used with audit trail
    UPDATE public.pending_employees
    SET is_used = true, activated_at = now(), activated_by = p_user_id
    WHERE id = v_pending.id;
END;
$$;

-- Fix activate_employee_oauth - add audit trail columns
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(
  p_activation_code TEXT, p_email TEXT, p_full_name TEXT, p_google_id TEXT, p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'message', 'كود التفعيل مطلوب');
  END IF;
  
  -- FOR UPDATE prevents concurrent activation
  SELECT * INTO v_pending
  FROM public.pending_employees
  WHERE activation_code = trim(p_activation_code)
  AND is_used = false
  AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND is_used = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED', 'message', 'كود التفعيل مستخدم بالفعل');
    END IF;
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND expires_at <= now()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED', 'message', 'انتهت صلاحية كود التفعيل');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND', 'message', 'كود التفعيل غير موجود');
  END IF;
  
  INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id, google_id, email, email_verified)
  VALUES (
    p_user_id, v_pending.name, v_pending.phone, v_pending.role, 
    v_pending.employee_type, v_pending.organization_id, p_google_id, p_email, true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = v_pending.name,
    role = v_pending.role,
    employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_pending.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_pending.organization_id, p_user_id, v_pending.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark as used with audit trail
  UPDATE public.pending_employees
  SET is_used = true, activated_at = now(), activated_by = p_user_id
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', v_pending.role::text,
    'employee_type', v_pending.employee_type::text,
    'organization_id', v_pending.organization_id,
    'full_name', v_pending.name
  );
END;
$$;
