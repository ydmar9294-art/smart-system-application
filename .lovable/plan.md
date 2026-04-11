

# خطة التعديلات الأربعة — نظام عملات + إزالة الإنجليزية + جرد لحظي + تعادل صرف

## الملخص التنفيذي
أربعة تعديلات جوهرية: (1) نظام عملات عربية متعدد، (2) إزالة كاملة للغة الإنجليزية، (3) جرد مواد لحظي في واجهة المالك، (4) نظام تعادل عملات مع الدولار يؤثر على الأسعار والتقارير.

---

## المرحلة 1: إزالة اللغة الإنجليزية بالكامل

**حذف/تعديل:**
- حذف `src/locales/en.ts` بالكامل
- حذف `src/components/LanguageSwitcher.tsx`
- تعديل `src/lib/i18n.ts` — تبسيطه ليحمّل العربية فقط، إزالة `LanguageDetector`، تثبيت `lng: 'ar'` و `dir: 'rtl'`
- تعديل `src/components/Layout.tsx` — إزالة زر تبديل اللغة وكل ما يتعلق بـ `showLangSwitcher` و `Globe`
- إزالة `i18next-browser-languagedetector` من `package.json`
- تعديل `index.html` — تثبيت `dir="rtl"` و `lang="ar"`

**ملاحظة أمان:** كل استدعاءات `t('key')` تبقى تعمل لأن الملف العربي يغطي جميع المفاتيح. `useTranslation` يبقى كما هو — فقط ملف الإنجليزية يُحذف.

---

## المرحلة 2: نظام العملات العربية

**جدول جديد في قاعدة البيانات:**
```sql
CREATE TABLE currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,        -- 'SYP', 'USD', 'SAR', ...
  name_ar text NOT NULL,             -- 'ليرة سورية'
  symbol text NOT NULL,              -- 'ل.س'
  country text NOT NULL,             -- 'سوريا'
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**بيانات أولية — جميع العملات العربية:**
| الكود | الاسم | الرمز | الدولة |
|-------|-------|-------|--------|
| SYP | ليرة سورية | ل.س | سوريا |
| USD | دولار أمريكي | $ | الولايات المتحدة |
| SAR | ريال سعودي | ر.س | السعودية |
| AED | درهم إماراتي | د.إ | الإمارات |
| KWD | دينار كويتي | د.ك | الكويت |
| BHD | دينار بحريني | د.ب | البحرين |
| QAR | ريال قطري | ر.ق | قطر |
| OMR | ريال عُماني | ر.ع | عُمان |
| EGP | جنيه مصري | ج.م | مصر |
| IQD | دينار عراقي | د.ع | العراق |
| JOD | دينار أردني | د.أ | الأردن |
| LBP | ليرة لبنانية | ل.ل | لبنان |
| LYD | دينار ليبي | د.ل | ليبيا |
| TND | دينار تونسي | د.ت | تونس |
| DZD | دينار جزائري | د.ج | الجزائر |
| MAD | درهم مغربي | د.م | المغرب |
| SDG | جنيه سوداني | ج.س | السودان |
| YER | ريال يمني | ر.ي | اليمن |
| MRU | أوقية موريتانية | أ.م | موريتانيا |
| SOS | شلن صومالي | ش.ص | الصومال |
| KMF | فرنك قمري | ف.ق | جزر القمر |
| DJF | فرنك جيبوتي | ف.ج | جيبوتي |

**جدول ربط العملة بالمنشأة:**
```sql
ALTER TABLE organizations ADD COLUMN currency_code text DEFAULT 'SYP';
```

**تعديلات الكود:**
- تعديل `src/constants/index.ts` — تحويل `CURRENCY` من ثابت إلى قيمة ديناميكية تُقرأ من المنشأة
- إنشاء `src/hooks/useCurrency.ts` — hook يُرجع رمز العملة الحالي للمنشأة
- إنشاء واجهة اختيار العملة في إعدادات المالك

---

## المرحلة 3: نظام تعادل العملات مع الدولار

**جدول أسعار الصرف:**
```sql
CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  currency_code text NOT NULL,         -- عملة المنشأة
  rate_to_usd numeric NOT NULL,        -- سعر الصرف مقابل الدولار
  previous_rate numeric,               -- السعر السابق (لحساب الفروقات)
  effective_date timestamptz DEFAULT now(),
  updated_by uuid,
  created_at timestamptz DEFAULT now()
);

-- سجل تاريخي لتتبع تغيرات الصرف
CREATE TABLE exchange_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  currency_code text NOT NULL,
  old_rate numeric NOT NULL,
  new_rate numeric NOT NULL,
  change_percentage numeric NOT NULL,
  changed_by uuid,
  created_at timestamptz DEFAULT now()
);
```

**RLS:**
- `exchange_rates`: قراءة/كتابة لأعضاء المنشأة، Owner فقط يعدّل
- `exchange_rate_history`: قراءة لأعضاء المنشأة

**التأثير على المنظومة:**
- إنشاء `src/services/exchangeRateService.ts` — CRUD لأسعار الصرف
- إنشاء `src/hooks/useExchangeRate.ts` — hook يوفر سعر الصرف الحالي + حساب الأرباح/الخسائر
- تعديل `OwnerOverviewTab.tsx` — إضافة بطاقة KPI لسعر الصرف + ربح/خسارة فروقات
- تعديل `FinanceTab.tsx` — إضافة قسم "فروقات أسعار الصرف" مع الأرباح والخسائر
- تعديل واجهات المحاسب والموزع لعرض المكافئ بالدولار عند الحاجة
- إنشاء مكوّن `ExchangeRateManager.tsx` في إعدادات المالك لتحديث السعر

**منطق حساب الفروقات:**
```text
ربح/خسارة الصرف = (السعر الجديد - السعر القديم) × إجمالي القيمة بالدولار
```
يُحسب على: المخزون، الذمم المدينة، المبيعات

---

## المرحلة 4: جرد مواد المستودع اللحظي في واجهة المالك

**تعديل `OwnerOverviewTab.tsx` أو إضافة قسم جديد في `InventoryTab.tsx`:**
- عرض جدول كامل بكل المنتجات النشطة يشمل:
  - اسم المنتج | الفئة | الكمية الحالية | سعر التكلفة | سعر البيع | القيمة الإجمالية
- مجموع القيم في أسفل الجدول
- بحث وفلترة
- تحديث لحظي عبر Realtime subscription (إن كان مفعّلاً) أو عبر polling كل 30 ثانية

**تعديل `InventoryTab.tsx`:**
- إضافة عرض "جرد كامل" كـ sub-tab جديد `stock-audit` يعرض كل المنتجات مع أسعارها الحالية بشكل جدولي واضح

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/locales/en.ts` | **حذف** |
| `src/components/LanguageSwitcher.tsx` | **حذف** |
| `src/lib/i18n.ts` | تبسيط — عربي فقط |
| `src/components/Layout.tsx` | إزالة زر اللغة |
| `index.html` | تثبيت RTL + ar |
| `src/constants/index.ts` | تحويل CURRENCY لديناميكي |
| `src/hooks/useCurrency.ts` | **جديد** — hook العملة |
| `src/hooks/useExchangeRate.ts` | **جديد** — hook سعر الصرف |
| `src/services/exchangeRateService.ts` | **جديد** — خدمة الصرف |
| `src/features/owner/components/ExchangeRateManager.tsx` | **جديد** — واجهة تحديث السعر |
| `src/features/owner/components/CurrencySelector.tsx` | **جديد** — اختيار العملة |
| `src/features/owner/components/OwnerOverviewTab.tsx` | تعزيز — KPI الصرف + جرد لحظي |
| `src/features/owner/components/InventoryTab.tsx` | تعزيز — sub-tab جرد كامل |
| `src/features/owner/components/FinanceTab.tsx` | تعزيز — فروقات الصرف |
| `src/features/owner/components/OwnerDashboard.tsx` | إضافة تبويب إعدادات العملة |
| `src/locales/ar.ts` | إضافة مفاتيح العملات والصرف |
| `supabase/migrations/` | 3 migrations: currencies, exchange_rates, exchange_rate_history |

## ملاحظات SaaS Production
- جميع الجداول محمية بـ RLS
- سعر الصرف يُخزَّن per-organization — كل منشأة لها سعرها
- سجل تاريخي كامل لتغيرات الصرف (audit trail)
- لا تعديل على الجداول الحالية (additive only) ما عدا إضافة عمود `currency_code` للمنشآت
- `statement_timeout` 5 ثوانٍ على أي RPC جديد

