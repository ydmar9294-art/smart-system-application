
-- =============================================
-- USER CONSENT TRACKING
-- =============================================
CREATE TABLE public.user_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL DEFAULT 'privacy_terms',
  app_version TEXT NOT NULL DEFAULT '1.0.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own consents"
ON public.user_consents FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own consents"
ON public.user_consents FOR INSERT
WITH CHECK (user_id = auth.uid());

-- =============================================
-- ACCOUNT DELETION RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_own_account_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'غير مسجل دخول');
  END IF;

  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = v_user_id;

  -- Owners cannot self-delete (must go through org deletion)
  IF v_role = 'OWNER' THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يمكن لصاحب المنشأة حذف حسابه مباشرة. يرجى التواصل مع الدعم لحذف المنشأة بالكامل.');
  END IF;

  -- Developers cannot self-delete
  IF v_role = 'DEVELOPER' THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يمكن حذف حساب المطور');
  END IF;

  -- Audit log
  INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_org_id, v_user_id, 'ACCOUNT_SELF_DELETE', 'profile', v_user_id,
    jsonb_build_object('role', v_role, 'deleted_at', now())
  );

  -- Remove user notifications
  DELETE FROM user_notifications WHERE user_id = v_user_id;

  -- Remove user consents
  DELETE FROM user_consents WHERE user_id = v_user_id;

  -- Remove devices
  DELETE FROM devices WHERE user_id = v_user_id;

  -- Anonymize profile (keep record for org audit, but clear PII)
  UPDATE profiles SET
    full_name = 'حساب محذوف',
    email = NULL,
    phone = NULL,
    is_active = false,
    license_key = NULL
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف حسابك بنجاح');
END;
$$;
