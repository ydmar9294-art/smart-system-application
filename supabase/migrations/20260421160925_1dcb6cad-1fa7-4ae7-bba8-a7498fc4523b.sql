-- ============================================
-- إعادة تصميم نظام العملات: SYP / USD فقط (محاولة 2)
-- ============================================

-- 0) تنظيف أسعار الصرف غير المتعلقة بـ SYP/USD أولاً
DELETE FROM public.exchange_rates
WHERE NOT (
  (from_currency = 'USD' AND to_currency = 'SYP')
  OR (from_currency = 'SYP' AND to_currency = 'USD')
);

-- 1) حذف أي عملات موجودة غير SYP/USD
DELETE FROM public.org_currencies
WHERE currency_code NOT IN ('SYP', 'USD');

-- 2) ضمان وجود SYP و USD لكل منشأة
INSERT INTO public.org_currencies (organization_id, currency_code, currency_name_ar, symbol, is_base, is_active)
SELECT o.id, 'SYP', 'ليرة سورية', 'ل.س', true, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_currencies c
  WHERE c.organization_id = o.id AND c.currency_code = 'SYP'
);

INSERT INTO public.org_currencies (organization_id, currency_code, currency_name_ar, symbol, is_base, is_active)
SELECT o.id, 'USD', 'دولار أمريكي', '$', false, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_currencies c
  WHERE c.organization_id = o.id AND c.currency_code = 'USD'
);

-- 3) ضمان أن SYP هي الأساسية دائماً
UPDATE public.org_currencies SET is_base = false WHERE currency_code <> 'SYP';
UPDATE public.org_currencies SET is_base = true WHERE currency_code = 'SYP';

-- 4) قيد على org_currencies: SYP أو USD فقط
ALTER TABLE public.org_currencies
  DROP CONSTRAINT IF EXISTS org_currencies_code_whitelist;
ALTER TABLE public.org_currencies
  ADD CONSTRAINT org_currencies_code_whitelist
  CHECK (currency_code IN ('SYP', 'USD'));

-- 5) قيد على exchange_rates: فقط بين SYP و USD
ALTER TABLE public.exchange_rates
  DROP CONSTRAINT IF EXISTS exchange_rates_pair_whitelist;
ALTER TABLE public.exchange_rates
  ADD CONSTRAINT exchange_rates_pair_whitelist
  CHECK (
    (from_currency = 'USD' AND to_currency = 'SYP')
    OR (from_currency = 'SYP' AND to_currency = 'USD')
  );

-- 6) إضافة pricing_currency على products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_currency text NOT NULL DEFAULT 'SYP';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pricing_currency_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_pricing_currency_check
  CHECK (pricing_currency IN ('SYP', 'USD'));

-- 7) cost_price: default 0 (مهجور من الواجهات)
ALTER TABLE public.products
  ALTER COLUMN cost_price SET DEFAULT 0;