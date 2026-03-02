
-- =============================================
-- Phase 4: Subscription-Based Licensing System
-- =============================================

-- 1. Add subscription fields to developer_licenses
ALTER TABLE public.developer_licenses 
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_alert_days INT DEFAULT 3;

-- 2. Create subscription_payments table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES public.developer_licenses(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  duration_months INT NOT NULL DEFAULT 1,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  submitted_by UUID NOT NULL,
  submitted_by_role TEXT NOT NULL DEFAULT 'OWNER',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  device_id TEXT,
  is_first_subscription BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Developers can manage subscription payments"
  ON public.subscription_payments FOR ALL
  USING (is_developer());

CREATE POLICY "Org members can read own payments"
  ON public.subscription_payments FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "Owners can submit payments"
  ON public.subscription_payments FOR INSERT
  WITH CHECK (
    organization_id = get_my_org_id() 
    AND submitted_by = auth.uid()
    AND get_my_role() = 'OWNER'
  );

-- 5. Storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Upload payment receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Read payment receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR is_developer()
    )
  );

-- 6. Approve subscription payment (developer only)
CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_payment_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment RECORD;
  v_license RECORD;
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
BEGIN
  IF NOT is_developer() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT * INTO v_payment FROM subscription_payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'طلب الدفع غير موجود'); END IF;
  IF v_payment.status != 'PENDING' THEN RETURN jsonb_build_object('success', false, 'message', 'تم معالجة هذا الطلب مسبقاً'); END IF;

  SELECT * INTO v_license FROM developer_licenses WHERE id = v_payment.license_id;

  IF v_payment.is_first_subscription THEN
    v_new_start := COALESCE(p_start_date, v_license."expiryDate", now());
  ELSE
    v_new_start := GREATEST(COALESCE(v_license."expiryDate", now()), now());
  END IF;

  v_new_end := v_new_start + (v_payment.duration_months || ' months')::INTERVAL;

  UPDATE subscription_payments SET
    status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now(),
    subscription_start = v_new_start, subscription_end = v_new_end
  WHERE id = p_payment_id;

  UPDATE developer_licenses SET
    "expiryDate" = v_new_end, status = 'ACTIVE',
    type = CASE WHEN type = 'TRIAL' THEN 'SUBSCRIPTION' ELSE type END
  WHERE id = v_payment.license_id;

  IF v_payment.submitted_by IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (v_payment.submitted_by, 'تم تفعيل الاشتراك ✅',
      'تم الموافقة على دفعتك وتفعيل اشتراكك حتى ' || to_char(v_new_end, 'YYYY-MM-DD'),
      'success', jsonb_build_object('action', 'subscription_approved', 'end_date', v_new_end));
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل الاشتراك بنجاح',
    'start_date', v_new_start, 'end_date', v_new_end);
END;
$$;

-- 7. Reject subscription payment (developer only)
CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_payment_id UUID,
  p_reason TEXT DEFAULT 'لم يتم التحقق من الحوالة'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  IF NOT is_developer() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT * INTO v_payment FROM subscription_payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'طلب الدفع غير موجود'); END IF;
  IF v_payment.status != 'PENDING' THEN RETURN jsonb_build_object('success', false, 'message', 'تم معالجة هذا الطلب مسبقاً'); END IF;

  UPDATE subscription_payments SET
    status = 'REJECTED', rejection_reason = p_reason,
    reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_payment_id;

  INSERT INTO user_notifications (user_id, title, description, type, data)
  VALUES (v_payment.submitted_by, 'تم رفض طلب الدفع ❌',
    'سبب الرفض: ' || p_reason || '. يمكنك إعادة رفع الحوالة.',
    'warning', jsonb_build_object('action', 'subscription_rejected', 'reason', p_reason, 'payment_id', p_payment_id));

  RETURN jsonb_build_object('success', true, 'message', 'تم رفض الطلب');
END;
$$;

-- 8. Create first subscription (developer only, auto-approved)
CREATE OR REPLACE FUNCTION public.create_first_subscription(
  p_license_id UUID,
  p_duration_months INT,
  p_monthly_price NUMERIC DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license RECORD;
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_owner_id UUID;
BEGIN
  IF NOT is_developer() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT * INTO v_license FROM developer_licenses WHERE id = p_license_id;
  IF v_license IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الترخيص غير موجود'); END IF;

  IF p_monthly_price IS NOT NULL THEN
    UPDATE developer_licenses SET monthly_price = p_monthly_price WHERE id = p_license_id;
  END IF;

  v_new_start := COALESCE(v_license."expiryDate", now());
  v_new_end := v_new_start + (p_duration_months || ' months')::INTERVAL;

  INSERT INTO subscription_payments (
    organization_id, license_id, amount, duration_months,
    status, submitted_by, submitted_by_role, reviewed_by, reviewed_at,
    subscription_start, subscription_end, is_first_subscription
  ) VALUES (
    v_license.organization_id, p_license_id,
    COALESCE(p_monthly_price, v_license.monthly_price, 0) * p_duration_months,
    p_duration_months, 'APPROVED', auth.uid(), 'DEVELOPER', auth.uid(), now(),
    v_new_start, v_new_end, true
  );

  UPDATE developer_licenses SET
    "expiryDate" = v_new_end, status = 'ACTIVE', type = 'SUBSCRIPTION'
  WHERE id = p_license_id;

  v_owner_id := v_license."ownerId";
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (v_owner_id, 'تم تفعيل اشتراكك ✅',
      'تم تفعيل اشتراكك حتى ' || to_char(v_new_end, 'YYYY-MM-DD'),
      'success', jsonb_build_object('action', 'subscription_activated', 'end_date', v_new_end));
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم إنشاء الاشتراك بنجاح',
    'start_date', v_new_start, 'end_date', v_new_end);
END;
$$;

-- 9. Developer renew subscription for any org
CREATE OR REPLACE FUNCTION public.developer_renew_subscription(
  p_license_id UUID,
  p_duration_months INT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license RECORD;
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_owner_id UUID;
BEGIN
  IF NOT is_developer() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT * INTO v_license FROM developer_licenses WHERE id = p_license_id;
  IF v_license IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'الترخيص غير موجود'); END IF;

  v_new_start := GREATEST(COALESCE(v_license."expiryDate", now()), now());
  v_new_end := v_new_start + (p_duration_months || ' months')::INTERVAL;

  INSERT INTO subscription_payments (
    organization_id, license_id, amount, duration_months,
    status, submitted_by, submitted_by_role, reviewed_by, reviewed_at,
    subscription_start, subscription_end, is_first_subscription
  ) VALUES (
    v_license.organization_id, p_license_id,
    COALESCE(v_license.monthly_price, 0) * p_duration_months,
    p_duration_months, 'APPROVED', auth.uid(), 'DEVELOPER', auth.uid(), now(),
    v_new_start, v_new_end, false
  );

  UPDATE developer_licenses SET "expiryDate" = v_new_end, status = 'ACTIVE'
  WHERE id = p_license_id;

  v_owner_id := v_license."ownerId";
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (v_owner_id, 'تم تجديد اشتراكك ✅',
      'تم تجديد اشتراكك حتى ' || to_char(v_new_end, 'YYYY-MM-DD'),
      'success', jsonb_build_object('action', 'subscription_renewed', 'end_date', v_new_end));
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم تجديد الاشتراك',
    'start_date', v_new_start, 'end_date', v_new_end);
END;
$$;

-- 10. Audit trigger
CREATE TRIGGER audit_subscription_payments
  AFTER INSERT OR UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 11. Notify developers on new payment request
CREATE OR REPLACE FUNCTION public.notify_developer_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dev_id UUID;
  v_org_name TEXT;
  v_submitter_name TEXT;
BEGIN
  IF NEW.status = 'PENDING' AND NEW.submitted_by_role = 'OWNER' THEN
    SELECT name INTO v_org_name FROM organizations WHERE id = NEW.organization_id;
    SELECT full_name INTO v_submitter_name FROM profiles WHERE id = NEW.submitted_by;

    FOR v_dev_id IN SELECT id FROM profiles WHERE role = 'DEVELOPER' AND is_active = true LOOP
      INSERT INTO user_notifications (user_id, title, description, type, data)
      VALUES (v_dev_id, 'طلب اشتراك جديد 💳',
        'قدّم ' || COALESCE(v_submitter_name, 'مالك') || ' طلب اشتراك للمنشأة "' || COALESCE(v_org_name, '') || '". المبلغ: ' || NEW.amount,
        'info', jsonb_build_object('action', 'new_payment_request', 'payment_id', NEW.id, 'org_name', v_org_name));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_payment_request
  AFTER INSERT ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_developer_on_payment();

-- 12. Update get_my_license_info to include monthly_price
DROP FUNCTION IF EXISTS public.get_my_license_info();

CREATE FUNCTION public.get_my_license_info()
RETURNS TABLE(
  id uuid, license_key text, org_name text, type text, status text,
  expiry_date timestamptz, days_valid integer, max_employees integer,
  organization_id uuid, created_at timestamptz, monthly_price numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dl.id, dl."licenseKey", dl."orgName", dl.type, dl.status,
    dl."expiryDate", dl.days_valid, dl.max_employees,
    dl.organization_id, dl.created_at, dl.monthly_price
  FROM developer_licenses dl
  WHERE dl."licenseKey" IN (
    SELECT p.license_key FROM profiles p WHERE p.id = auth.uid()
  )
$$;
