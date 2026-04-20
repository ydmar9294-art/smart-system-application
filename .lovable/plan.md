

## الخطة — 4 مهام جذرية

### المهمة 1: إصلاح رسالة "تم تسجيل الدخول من جهاز آخر" الكاذبة عند إنشاء حساب جديد

**السبب الجذري:** الدالة `handleRegister` في `supabase/functions/device-check/index.ts` تعتبر **أي** جهاز سابق (حتى لو غير نشط فعلياً منذ أشهر) جهازاً يستحق رسالة `DEVICE_REPLACED`. عند إنشاء حساب جديد قد توجد صفوف قديمة في `devices` (من جلسات اختبار أو OAuth فاشل) تطلق هذه الرسالة.

**الإصلاح (Edge Function `device-check`):**
- في `handleRegister`، تصفية الأجهزة "النشطة" بشرط إضافي: `last_seen >= now() - 24 hours`. أي جهاز أقدم يُعتبر مهجوراً ويتم تعطيله **بصمت** دون إطلاق `DEVICE_REPLACED` ولا تسجيل `audit_logs`.
- أيضاً في `handlePreCheck`: نفس التصفية حتى لا تظهر شاشة التحذير `ActiveSessionWarningDialog` للأجهزة المهجورة.

**الإصلاح (AuthFlow.tsx):**
- إضافة فحص: إذا كانت قيمة `replaced_device_name` فارغة أو غير معرّفة (حالة الحساب الجديد بدون جهاز سابق فعلي)، عدم إطلاق حدث `device-replaced-warning`.

> لا تغيير في عقد API (الحقول نفسها) — تغيير سلوكي فقط ضمن نفس الـ status.

---

### المهمة 2: حذف واجهة أمين المستودع ونقل وظائفها إلى إعدادات الأونر

**النقل (إضافي وآمن):**
- إضافة 3 صفحات فرعية جديدة لتبويب الإعدادات في `OwnerSettingsSheet.tsx`:
  - **حركات المخزون** (`stock-movements`) — يُحمّل `StockMovementsTab` lazy.
  - **التوريدات** (`deliveries`) — يُحمّل `DeliveriesTab` (موجود مسبقاً).
  - **مرتجع المشتريات** (`purchase-returns`) — يُحمّل `InventoryTab` بـ `forceSubTab="purchase-returns"`.
- في `OwnerDashboard.tsx` `renderSubPage`: إضافة الحالات الجديدة.
- في `OwnerDashboard.tsx` `subPageTitle`: إضافة العناوين العربية.

> الأسعار والمشتريات وقائمة المنتجات: موجودة بالفعل في تبويب **المخزون** (`InventoryTab`) لدى الأونر — لا حاجة لنقلها.

**الحذف (بعد نقل الوظائف):**
- حذف ملف `src/features/warehouse/components/WarehouseKeeperDashboard.tsx`.
- حذف `src/features/warehouse/components/StockMovementsTab.tsx` بعد نقله إلى مسار مشترك (سننقله إلى `src/features/owner/components/StockMovementsTab.tsx` للحفاظ على عمله).
- تحديث `src/features/warehouse/index.ts` ليصبح فارغاً أو حذف المجلد كلياً.
- في `src/App.tsx`:
  - حذف `import` و `lazy()` لـ `WarehouseKeeperDashboard`.
  - في `ViewManager`: تعديل `case EmployeeType.WAREHOUSE_KEEPER` ليُعيد توجيه المستخدم لشاشة "تم إيقاف هذا النوع من الحسابات — راجع المالك" أو إلى `AccountantDashboard` كاحتياط آمن (لأن الحسابات الموجودة في DB لا تزال).

> **توافق رجعي:** نوع `EmployeeType.WAREHOUSE_KEEPER` يبقى في `types/index.ts` و RPC، فقط الواجهة محذوفة. الأكواد الموجودة لأمناء مستودعات في DB سترى رسالة "حسابك معطّل" أو لوحة المحاسب البديلة.

---

### المهمة 3: نافذة اختيار العملات الأساسية والثانوية وأسعار الصرف عند إنشاء المنشأة

**الإصلاح في DB (Migration):**
- تعديل `create_self_service_trial` RPC لإضافة 3 معاملات جديدة (additive):
  - `p_base_currency_code text`, `p_base_currency_name text`, `p_base_currency_symbol text`
  - بقاء التوقيع القديم متاحاً عبر `DEFAULT NULL` لكل معامل جديد ⇒ **لا breaking change**.
- إذا تم تمرير العملة الأساسية، يتم إدراجها في `org_currencies` بـ `is_base = true, is_active = true` بدلاً من اعتماد `SYP` افتراضياً.
- إذا لم تُمرَّر (نسخ قديمة من العميل)، يبقى السلوك الحالي (لا عملة افتراضية).

**واجهة (frontend):**
- تعديل `SelfServiceTrialModal.tsx` لإضافة **خطوة 3** بعد ملء بيانات الشركة:
  - اختيار **العملة الأساسية** من قائمة `COMMON_CURRENCIES` (موجودة مسبقاً في `CurrenciesTab.tsx`، نُعيد استخدامها عبر استخراج ثابت مشترك في `src/constants/currencies.ts`).
  - زر "إضافة عملة ثانوية (اختياري)" — يفتح اختيار عملة ثانية + حقل سعر الصرف من الأساسية إلى الثانوية.
- بعد نجاح RPC إنشاء التجربة: إذا أُضيفت عملة ثانوية، استدعاء `currencyService.add` و `currencyService.addRate`.

> العملاء الحاليون لن تتأثر تجربتهم (الحقول الجديدة اختيارية). الأونرز الجدد يُجبرون على اختيار العملة الأساسية.

---

### المهمة 4: نقل تخطيط مسارات الموزعين إلى واجهة الأونر

**الوضع الحالي:** الأونر لديه تبويب `tracking` في الإعدادات يعرض `AgentMapView` فقط. مكوّن `RoutePlanner` موجود ويعمل مع صلاحيات `OWNER` على جداول `routes` و `route_stops` (RLS تسمح للأونر بالـ INSERT).

**الإصلاح (frontend فقط):**
- في `OwnerDashboard.tsx` `renderSubPage` الحالة `'tracking'`: إضافة `RoutePlanner`, `RouteHistory`, `RouteKPIs` مع `AgentMapView` ضمن نفس الصفحة الفرعية (تابات داخلية أو scroll).
- استخدام `React.lazy` للجميع للحفاظ على أداء التحميل.
- إعادة تسمية تسمية التبويب من "التتبع" إلى "تتبع المسارات والخريطة".

> RLS موجودة وتعمل للأونر — لا حاجة لتغيير DB.

---

## ملخص الملفات

**معدّلة:**
- `supabase/functions/device-check/index.ts` (تصفية الأجهزة المهجورة)
- `src/features/auth/components/AuthFlow.tsx` (فحص اسم الجهاز)
- `src/features/auth/components/SelfServiceTrialModal.tsx` (خطوة العملات)
- `src/features/owner/components/OwnerDashboard.tsx` (صفحات فرعية جديدة + RoutePlanner)
- `src/features/owner/components/OwnerSettingsSheet.tsx` (3 إدخالات جديدة)
- `src/App.tsx` (حذف WarehouseKeeperDashboard من ViewManager)

**مضافة:**
- `src/constants/currencies.ts` (ثابت مشترك للعملات)
- `src/features/owner/components/StockMovementsTab.tsx` (منقول من warehouse)
- Migration: تحديث `create_self_service_trial` (additive params)

**محذوفة (بعد النقل الآمن):**
- `src/features/warehouse/components/WarehouseKeeperDashboard.tsx`
- `src/features/warehouse/components/StockMovementsTab.tsx`
- `src/features/warehouse/index.ts`

**ضمانات التوافق الرجعي:**
- `EmployeeType.WAREHOUSE_KEEPER` enum يبقى.
- معاملات RPC الجديدة كلها `DEFAULT NULL`.
- لا تغيير في schema الجداول (لا DROP COLUMN).
- جداول `org_currencies` و `exchange_rates` موجودة ومستخدمة فعلاً.
- RLS بدون تغيير.
