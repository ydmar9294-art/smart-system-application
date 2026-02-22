-- Add expiration column to pending_employees for activation code security
ALTER TABLE public.pending_employees 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Update activate_employee_oauth to check expiration
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(p_user_id uuid, p_google_id text, p_email text, p_full_name text, p_activation_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending RECORD;
BEGIN
  -- Validate activation code
  IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'message', 'كود التفعيل مطلوب');
  END IF;
  
  -- Find pending employee with expiration check
  SELECT * INTO v_pending
  FROM public.pending_employees
  WHERE activation_code = trim(p_activation_code)
  AND is_used = false
  AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Check if code exists but already used
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND is_used = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED', 'message', 'كود التفعيل مستخدم بالفعل');
    END IF;
    -- Check if code exists but expired
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND expires_at <= now()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED', 'message', 'انتهت صلاحية كود التفعيل');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND', 'message', 'كود التفعيل غير موجود');
  END IF;
  
  -- Create profile with Google OAuth data
  INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id, google_id, email, email_verified)
  VALUES (p_user_id, COALESCE(p_full_name, v_pending.name), v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id, p_google_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, v_pending.name),
    role = v_pending.role,
    employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_pending.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link to organization
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_pending.organization_id, p_user_id, v_pending.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark as used (single-use enforcement)
  UPDATE public.pending_employees
  SET is_used = true
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', v_pending.role::text,
    'employee_type', v_pending.employee_type::text,
    'organization_id', v_pending.organization_id,
    'organization_name', v_pending.name
  );
END;
$function$;

-- Also update the non-OAuth activate_employee function
CREATE OR REPLACE FUNCTION public.activate_employee(p_user_id uuid, p_activation_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_pending RECORD;
BEGIN
    -- Validate activation code format
    IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
        RAISE EXCEPTION 'Activation code is required';
    END IF;
    
    -- Find pending employee with expiration check
    SELECT * INTO v_pending
    FROM public.pending_employees
    WHERE activation_code = trim(p_activation_code) 
    AND is_used = false
    AND (expires_at IS NULL OR expires_at > now());
    
    IF NOT FOUND THEN
        -- Check if expired
        IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND expires_at <= now()) THEN
            RAISE EXCEPTION 'Activation code has expired';
        END IF;
        RAISE EXCEPTION 'Activation code not found or already used';
    END IF;
    
    -- Create profile
    INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id)
    VALUES (p_user_id, v_pending.name, v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id)
    ON CONFLICT (id) DO UPDATE SET
        full_name = v_pending.name,
        role = v_pending.role,
        employee_type = v_pending.employee_type,
        organization_id = v_pending.organization_id;
    
    -- Add user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, v_pending.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Link to organization
    INSERT INTO public.organization_users (organization_id, user_id, role)
    VALUES (v_pending.organization_id, p_user_id, v_pending.role)
    ON CONFLICT DO NOTHING;
    
    -- Mark as used (single-use enforcement)
    UPDATE public.pending_employees
    SET is_used = true
    WHERE id = v_pending.id;
END;
$function$;