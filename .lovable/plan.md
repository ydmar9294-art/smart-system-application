
## تحليل الواجهة الحالية للمالك (OwnerDashboard)

### البنية الحالية
الواجهة الحالية مبنية كصفحة "ويب" تقليدية ضمن `max-w-lg mx-auto`، تتكون من:

1. **الهيدر**: شارة المستخدم + AI + WhatsApp + خروج (مكدّسة عمودياً، تأخذ مساحة كبيرة).
2. **شريط Tabs أساسي علوي** (5 أزرار): الرئيسية، الفريق، الزبائن، المالية، الأداء.
3. **شريط Tabs ثانوي** (5 أزرار): التتبع، العملات، النسخ الاحتياطي، الاشتراك، القانوني.
4. **محتوى التبويب** أسفله مباشرة.
5. **نافذة إضافة موظف** (Modal مركزي).

### المشاكل الحالية (UX/UI)
| # | المشكلة | الأثر |
|---|---|---|
| 1 | شريطي تبويب علويين مكدّسين = 10 أزرار في الأعلى | ازدحام بصري، يبدو "ويب" |
| 2 | الهيدر يأخذ ~30% من الشاشة | تقليل مساحة المحتوى |
| 3 | لا يوجد Bottom Tab Bar | الإصبع يصل بصعوبة للأعلى في الهواتف الكبيرة |
| 4 | الإعدادات (اشتراك/نسخ/قانوني/عملات) متناثرة كتبويبات منفصلة | تشتيت |
| 5 | Tabs ثانوية بألوان "warning" غير منطقية | مربك بصرياً |
| 6 | زر الخروج بارز جداً في الهيدر | خطر ضغط خاطئ |

---

## التصميم الجديد: "Native Mobile Experience"

### المبدأ
تحويل الواجهة إلى تجربة شبيهة بـ iOS/Android Native: هيدر مدمج علوي خفيف + **شريط سفلي عائم (Floating Bottom Tab Bar)** + شيتات منزلقة (Bottom Sheets) للإعدادات الفرعية.

### 1) الهيدر العلوي المدمج (Compact Header)
سطر واحد فقط:
```
[الإشعارات]  ●●●  اسم المالك / اسم المنشأة  ●●●  [AI]
```
- ارتفاع ~56px فقط.
- خلفية liquid-glass شفافة مع backdrop-blur.
- `safe-area-top` للنوتش.

### 2) الشريط السفلي الرئيسي (Bottom Tab Bar — 5 أزرار)
```text
┌─────────────────────────────────────────┐
│  🏠      👥      💰      📊      ⚙️     │
│ الرئيسية الفريق الزبائن  المالية الإعدادات│
└─────────────────────────────────────────┘
```
- 5 تبويبات أساسية فقط:
  1. **الرئيسية** (Overview)
  2. **الفريق** (Team)
  3. **الزبائن** (Customers)
  4. **المالية** (Finance + Performance مدموجين بـ sub-tabs داخلية)
  5. **الإعدادات** (يفتح Bottom Sheet)
- floating bar مع `liquid-glass`، حواف منحنية `rounded-3xl`، ظل ناعم.
- زر نشط: خلفية ملوّنة + scale + haptic feedback.
- `safe-area-bottom` للأجهزة بـ home indicator.

### 3) شيت الإعدادات (Settings Bottom Sheet)
عند الضغط على ⚙️ ينزلق من الأسفل sheet يحوي:

```text
─────  ━━━  (drag handle)  ─────
الإعدادات

  💳  الاشتراك              ›
  💾  النسخ الاحتياطي         ›
  💱  العملات والصرف          ›
  📍  تتبع المندوبين          ›
  🛡️  المعلومات القانونية     ›
  ─────────────────────────
  🔔  الإشعارات              ›
  💬  دعم واتساب              ›
  ─────────────────────────
  🚪  تسجيل الخروج
```
- كل بند يفتح Full-Screen Sheet للمحتوى الكامل.
- تصميم iOS-like: Cards مع separators، أيقونات ملوّنة، chevron.

### 4) Full-Screen Sub-Sheets
بدلاً من تبويبات منفصلة، كل قسم إعدادات يفتح كـ "صفحة فرعية" بهيدر يحوي:
- زر `←` للرجوع (يغلق الـ sheet)
- عنوان الصفحة
- المحتوى نفسه (SubscriptionTab, BackupTab, CurrenciesTab, AgentMapView, LegalInfoTab)

### 5) لمسات Native إضافية
- **Haptic feedback** عند تبديل التبويبات (Capacitor Haptics).
- **Spring animations** للـ bottom sheets (vaul library الموجودة).
- **Pull-to-refresh** متاح أصلاً عبر `PullToRefresh`.
- **Safe areas** صارمة (top notch + bottom indicator).
- **Active tab indicator**: نقطة صغيرة تحت الأيقونة النشطة + لون primary.
- إخفاء الشريط السفلي عند فتح modal (smooth slide down).

---

## الملفات المتأثرة (Additive — لا حذف)

```
جديد:
  src/features/owner/components/OwnerBottomNav.tsx       (الشريط السفلي)
  src/features/owner/components/OwnerSettingsSheet.tsx   (شيت الإعدادات)
  src/features/owner/components/OwnerCompactHeader.tsx   (الهيدر المدمج)
  src/features/owner/components/OwnerSubPageSheet.tsx    (الصفحات الفرعية)
  src/features/owner/components/FinanceWithPerformance.tsx (دمج المالية+الأداء)

تعديل:
  src/features/owner/components/OwnerDashboard.tsx       (إعادة هيكلة الـ layout فقط، نفس المنطق)
  src/locales/ar.ts                                       (إضافة مفاتيح: settings.subscription, settings.backup, ...)

لا تغيير على:
  - OwnerOverviewTab, TeamContent, CustomersTab, FinanceTab, PerformanceTab,
    SubscriptionTab, BackupTab, CurrenciesTab, LegalInfoTab, AgentMapView (تبقى كما هي تماماً)
  - أي backend / RLS / RPC / database
  - GuestDashboardShell سيتلقى نفس البنية تلقائياً
```

---

## ضمانات الاستقرار
- ✅ كل المنطق الموجود (stats, addEmployee, toggleEmployee, modals) يبقى كما هو.
- ✅ كل التبويبات الفرعية (Subscription, Backup, ...) تُستدعى نفس المكونات بدون تعديل.
- ✅ التوافق الكامل مع وضع الزائر (`data-guest-nav` يبقى موجوداً على أزرار الـ bottom nav).
- ✅ التوافق مع Capacitor Android API 26+.
- ✅ يحترم `safe-area-x`, `safe-area-bottom`, `safe-area-top`.
- ✅ RTL محفوظ بالكامل.

---

## خطة التنفيذ (مرحلة واحدة)
1. إنشاء `OwnerCompactHeader` (هيدر سطر واحد).
2. إنشاء `OwnerBottomNav` (5 أزرار + active state + haptics).
3. إنشاء `OwnerSettingsSheet` باستخدام `vaul Drawer` (موجود مسبقاً).
4. إنشاء `OwnerSubPageSheet` (full-screen drawer للصفحات الفرعية).
5. إنشاء `FinanceWithPerformance` (تبويب يحوي Finance + Performance بـ inner toggle).
6. إعادة هيكلة `OwnerDashboard.tsx` لاستخدام المكونات الجديدة (إزالة الـ tab bars القديمة).
7. إضافة مفاتيح الترجمة الجديدة في `ar.ts`.
8. اختبار: viewport 390x726 + 360x800 (شاشات صغيرة).

