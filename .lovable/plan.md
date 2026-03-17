

# خطة إضافة الميزات الأربع المفقودة — Smart System

## الوضع الحالي بعد تحليل الكود

| النظام | الحالة |
|--------|--------|
| GPS/Geolocation | غير موجود |
| الطباعة | `printService.ts` — iframe + window.print (A4 فقط، لا Bluetooth) |
| تصنيف العملاء | غير موجود — `customers` لا يحتوي classification |
| الإشعارات | موجود جزئياً: `NotificationCenter` + `pushNotificationService` + `user_notifications` — بدون triggers ذكية |
| Offline Queue | موجود: `useOfflineMutationQueue` (عام) + distributor sync engine (متقدم) |

---

## الميزة 1: تتبع المندوبين (GPS + Route Tracking)

### قاعدة البيانات
- جدول `distributor_locations`: `id`, `user_id`, `organization_id`, `latitude`, `longitude`, `accuracy`, `visit_type` (customer_visit | route_point | check_in), `customer_id?`, `notes?`, `is_synced`, `recorded_at`, `synced_at`
- فهارس: `user_id`, `organization_id + recorded_at`
- RLS: المندوب يكتب بياناته، المالك/مدير المبيعات يقرأون بيانات المنشأة

### التنفيذ
- تثبيت `@capacitor/geolocation` (موجود في package.json أو يُضاف)
- `src/platform/hooks/useGpsTracker.ts` — التقاط موقع عند زيارة عميل + كل 5 دقائق تلقائياً
- تخزين أوفلاين عبر IndexedDB المشفر الموجود (`offlineCache`) → مزامنة عبر `useOfflineMutationQueue` مع retry
- زر "تسجيل زيارة" في `DistributorDashboard` مع التقاط GPS تلقائي

### لوحة الإدارة
- تبويب "المسارات" في `OwnerDashboard` و `SalesManagerDashboard`
- عرض قائمة زيارات كل مندوب مع الوقت والموقع (نص — بدون خريطة تفاعلية مبدئياً)
- فلترة حسب المندوب والتاريخ

---

## الميزة 2: الطباعة الميدانية (Bluetooth Printing)

### قيد تقني مهم
Web Bluetooth API غير مدعوم بشكل موثوق في Capacitor WebView. الحل العملي:

### التنفيذ
- `src/lib/bluetoothPrintService.ts`:
  - **Web/Capacitor fallback**: يستخدم `printService.ts` الموجود (iframe + window.print)
  - **Native**: بنية جاهزة لربط Capacitor Bluetooth plugin خارجي (يُثبّت في Android Studio)
- `src/lib/escposFormatter.ts`: توليد أوامر ESC/POS لطابعات POS (58/80mm)
- تنسيق A4: الموجود حالياً في `InvoicePrint.tsx`
- حفظ PDF احتياطي: عبر `@capacitor/filesystem` + `invoicePdfService.ts` الموجود
- `PrintOptionsModal` component: اختيار A4 أو POS عند الطباعة

> ملاحظة: تكامل Bluetooth الحقيقي يحتاج native plugin يُثبّت خارج Lovable. سنبني UI + formatting + fallback بالكامل.

---

## الميزة 3: تصنيف العملاء وخطط الزيارات (ABC)

### قاعدة البيانات
- إضافة عمود `classification TEXT DEFAULT 'C'` لجدول `customers`
- جدول `visit_plans`: `id`, `organization_id`, `distributor_id`, `customer_id`, `customer_name`, `planned_date`, `status` (planned | completed | missed | skipped), `completed_at?`, `location_id?`, `notes?`, `created_at`
- RLS: المندوب يقرأ/يحدث خططه، المالك/مدير المبيعات يديرون جميع الخطط

### المنطق
- Edge Function `classify-customers`: يحسب من `sales` → A (أعلى 20% إيراداً)، B (30%)، C (50%)
- توليد خطة أسبوعية: A = 3 زيارات، B = 2، C = 1
- دعم أوفلاين: تحميل خطة اليوم إلى IndexedDB، تحديث الحالة محلياً → مزامنة

### الواجهات
- `VisitPlanTab` في `DistributorDashboard` — زيارات اليوم مع أزرار (تم/تخطي)
- `CustomerClassificationTab` في `OwnerDashboard`/`SalesManagerDashboard` — عرض التصنيفات + إدارة الخطط
- Badge (A/B/C) بجانب اسم العميل في جميع القوائم

---

## الميزة 4: التنبيهات الذكية التلقائية

### التنبيهات المطلوبة
| النوع | الشرط | المستلم |
|-------|-------|---------|
| مخزون منخفض | `stock <= min_stock` | المالك + أمين المستودع |
| تأخر تحصيل | فاتورة آجلة > 7 أيام بدون دفع | المالك + المحاسب |
| زيارة مفقودة | `visit_plans.status = planned` وتاريخها مضى | مدير المبيعات |
| مخزون موزع منخفض | `distributor_inventory.quantity < 5` | المندوب |

### التنفيذ
- Edge Function `check-alerts`: يفحص الشروط → يكتب في `user_notifications` عبر service_role
- منع تكرار: لا يرسل نفس التنبيه خلال 24 ساعة (فحص `user_notifications` الأخيرة)
- تعزيز `NotificationCenter` بأيقونات مختلفة حسب النوع
- Push notification عبر `pushNotificationService` الموجود
- جدول `alert_settings`: `id`, `organization_id`, `alert_type`, `threshold`, `is_enabled` — للتخصيص

---

## ترتيب التنفيذ المقترح

1. **الميزة 3** — تصنيف العملاء وخطط الزيارات (أساس للتتبع والتنبيهات)
2. **الميزة 4** — التنبيهات الذكية (تعتمد على البيانات الموجودة + خطط الزيارات)
3. **الميزة 1** — تتبع GPS (يحتاج `@capacitor/geolocation`)
4. **الميزة 2** — الطباعة Bluetooth (يحتاج native plugin خارجي)

## ملخص الملفات

| العنصر | ملفات جديدة | ملفات معدّلة |
|--------|------------|-------------|
| GPS | `useGpsTracker.ts`, `RouteTrackingTab.tsx`, migration | `DistributorDashboard`, `OwnerDashboard` |
| Bluetooth Print | `bluetoothPrintService.ts`, `escposFormatter.ts`, `PrintOptionsModal.tsx` | `InvoicePrint`, `InvoiceHistoryTab` |
| ABC + Visits | `classify-customers` edge fn, `VisitPlanTab.tsx`, `CustomerClassificationTab.tsx`, migration | `customers` table, `DistributorDashboard`, `OwnerDashboard` |
| Alerts | `check-alerts` edge fn, `alert_settings` migration | `NotificationCenter`, `user_notifications` RLS |

