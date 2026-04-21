CREATE OR REPLACE FUNCTION public.add_collection_rpc(
  p_sale_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'SYP',
  p_original_amount NUMERIC DEFAULT NULL,
  p_exchange_rate NUMERIC DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale RECORD;
  v_collection_id UUID;
  v_orig NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'غير مصادق'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر'; END IF;
  IF p_currency NOT IN ('SYP','USD') THEN RAISE EXCEPTION 'العملة غير مدعومة'; END IF;

  SELECT id, organization_id, customer_id, paid_amount, remaining, is_voided
    INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF v_sale.is_voided THEN RAISE EXCEPTION 'الفاتورة ملغاة'; END IF;
  IF v_sale.organization_id <> get_my_org_id() THEN RAISE EXCEPTION 'صلاحية مرفوضة'; END IF;
  IF p_amount > v_sale.remaining + 0.01 THEN RAISE EXCEPTION 'المبلغ أكبر من المتبقي'; END IF;

  v_orig := COALESCE(p_original_amount, p_amount);

  INSERT INTO public.collections (
    organization_id, sale_id, customer_id, amount, notes, collected_by,
    direction, currency, original_amount, exchange_rate
  ) VALUES (
    v_sale.organization_id, v_sale.id, v_sale.customer_id, p_amount, p_notes, v_user_id,
    'IN', p_currency, v_orig, COALESCE(p_exchange_rate, 1)
  )
  RETURNING id INTO v_collection_id;

  UPDATE public.sales
  SET paid_amount = paid_amount + p_amount,
      remaining = GREATEST(0, remaining - p_amount)
  WHERE id = v_sale.id;

  UPDATE public.customers
  SET balance = balance - p_amount
  WHERE id = v_sale.customer_id;

  RETURN v_collection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_payment_out_rpc(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'SYP',
  p_original_amount NUMERIC DEFAULT NULL,
  p_exchange_rate NUMERIC DEFAULT 1,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID := get_my_org_id();
  v_role TEXT := get_my_role();
  v_emp_type TEXT;
  v_customer RECORD;
  v_collection_id UUID;
  v_orig NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'غير مصادق'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر'; END IF;
  IF p_currency NOT IN ('SYP','USD') THEN RAISE EXCEPTION 'العملة غير مدعومة'; END IF;

  SELECT employee_type INTO v_emp_type FROM public.profiles WHERE id = v_user_id;
  IF v_role <> 'EMPLOYEE' OR v_emp_type <> 'FIELD_AGENT' THEN
    RAISE EXCEPTION 'صلاحية مرفوضة: فقط الموزع الميداني يمكنه إنشاء سند دفع';
  END IF;

  SELECT id, organization_id, balance INTO v_customer
  FROM public.customers WHERE id = p_customer_id FOR UPDATE;

  IF v_customer.id IS NULL THEN RAISE EXCEPTION 'الزبون غير موجود'; END IF;
  IF v_customer.organization_id <> v_org_id THEN RAISE EXCEPTION 'صلاحية مرفوضة'; END IF;
  IF v_customer.balance >= 0 THEN
    RAISE EXCEPTION 'لا يمكن الدفع: الزبون ليس له رصيد دائن';
  END IF;

  -- Cap payment at the credit owed (no over-payment)
  IF p_amount > ABS(v_customer.balance) + 0.01 THEN
    RAISE EXCEPTION 'المبلغ أكبر من الرصيد الدائن للزبون';
  END IF;

  v_orig := COALESCE(p_original_amount, p_amount);

  INSERT INTO public.collections (
    organization_id, sale_id, customer_id, amount, notes, collected_by,
    direction, currency, original_amount, exchange_rate
  ) VALUES (
    v_org_id, NULL, p_customer_id, p_amount, p_notes, v_user_id,
    'OUT', p_currency, v_orig, COALESCE(p_exchange_rate, 1)
  )
  RETURNING id INTO v_collection_id;

  -- Customer was credit (balance < 0). Payment OUT increases balance toward zero.
  UPDATE public.customers
  SET balance = balance + p_amount
  WHERE id = p_customer_id;

  RETURN v_collection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_payment_out_rpc(UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated;