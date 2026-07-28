
# دليل استخدام تفاعلي شامل

نظام مساعدة ثلاثي الطبقات لكل الأدوار (الإدارة / الموزع / المحاسب)، بالعربية RTL، مع الحفاظ على هوية Liquid-Glass وسرعة الأنيميشن الحالية (~120ms).

## المكوّنات

### 1) بنية أساسية مشتركة (`src/features/help/`)
- `HelpProvider.tsx` — Context يدير: هل الجولة تعمل الآن، الخطوة الحالية، فتح مركز المساعدة، فتح تلميح سياقي.
- `useOnboarding.ts` — Hook لقراءة/كتابة حالة الإنجاز محلياً:
  - مفتاح: `onboarding:v1:<role>:<userId>` → `{ completed: boolean, completedSteps: string[], skippedAt?: number }`.
  - يبدأ الجولة تلقائياً عند أول تسجيل دخول لدور معيّن، ويوقفها بعد الإتمام أو التخطي.
- `helpContent.ts` — مصدر واحد للنصوص: لكل دور مصفوفة خطوات + مقالات مركز المساعدة (كلها من `src/locales/ar.ts`).

### 2) الجولة التفاعلية (Coach Marks)
- `GuidedTour.tsx` — Overlay بـ Portal فوق `z-[10000]` (فوق كل الشيتات والنوافذ):
  - يضيء العنصر المستهدف بواسطة `data-tour="<id>"` (spotlight بقناع SVG + حواف مضيئة زجاجية).
  - بطاقة شرح متحركة بجانب العنصر: عنوان + وصف قصير + أزرار (التالي / السابق / تخطي / إنهاء).
  - يتعامل مع scroll تلقائي للعنصر، ومع تبديل التبويبات (ينتقل الدور تلقائياً للتبويب المطلوب قبل إبراز الزر داخله).
  - يحترم Safe-Area ويعمل على 360px حتى Desktop.

### 3) التلميحات السياقية (Contextual Tooltips)
- `HelpDot.tsx` — أيقونة صغيرة (?) قابلة لللمس (24×24) توضع بجانب العناصر المهمة، تفتح Popover قصيراً يشرح الوظيفة.
- تُخفى/تُظهر بمفتاح موحّد في الإعدادات: «إظهار تلميحات المساعدة».

### 4) مركز المساعدة (Help Center)
- `HelpCenterSheet.tsx` — يفتح كـ FullScreen Sheet من الإعدادات، محتوى مقسّم:
  - «ابدأ من هنا» (شرح مبسّط بحسب الدور)
  - مقالات: تسجيل الدخول، إنشاء حساب/تفعيل، لوحة التحكم، كل تبويب رئيسي.
  - «إعادة تشغيل الجولة التفاعلية» و«إعادة تعيين تلميحات المساعدة».
- بحث نصي بسيط داخل العناوين/الوصف.

### 5) نقطة الدخول
- بند جديد داخل `AppSettingsSheet` (يظهر لكل الأدوار): «دليل الاستخدام» بأيقونة `HelpCircle`، يفتح `HelpCenterSheet`.
- عند أول دخول للدور: تبدأ الجولة تلقائياً بعد تحميل الواجهة الرئيسية بـ 400ms.

## محتوى الجولات (خطوات مختصرة لكل دور)

**الإدارة (OWNER):** الترحيب → التنقل السفلي → إضافة منتج (المخزون) → إدارة الأسعار → إضافة موظف → التوريدات → المشتريات → المالية → الاشتراك → الإعدادات → «انتهت الجولة».

**الموزع (EMPLOYEE-Distributor):** الترحيب → مخزوني → فاتورة جديدة (إضافة منتج بالطرد/القطعة) → تسجيل تحصيل → ديون العملاء → سجل الفواتير → مسار اليوم/GPS → المزامنة اليدوية.

**المحاسب (EMPLOYEE-Accountant):** الترحيب → لوحة نظرة عامة → فواتير المبيعات → التحصيلات → الديون → المرتجعات (من الإعدادات) → التقارير → التنبيهات.

## التخزين والسلوك
- `localStorage` فقط (حسب اختيار المستخدم)، مع Namespace للدور والمستخدم لتجنّب التداخل عند تبديل الحسابات على نفس الجهاز.
- زر «إعادة تشغيل الجولة» يمسح مفتاح الدور الحالي فقط.
- لا تعديل على قاعدة البيانات، لا Migrations، لا Edge Functions.

## التفاصيل التقنية

- **Portal + z-index:** الجولة و Popovers فوق `z-[10000]` لتجاوز شيتات `z-[9999]` الحالية.
- **Targeting:** إضافة سمة `data-tour="owner.inventory.add"` على الأزرار المستهدفة فقط (بدون تغيير منطقها). قائمة السمات ثابتة داخل `helpContent.ts`.
- **قياس العنصر:** `getBoundingClientRect` + `ResizeObserver` + `scroll` listener لتحديث الـ spotlight بسلاسة، مع `requestAnimationFrame` للأداء.
- **الوصول (a11y):** `role="dialog"`, `aria-label` عربي، إمكانية إغلاق بـ Esc، وزر الرجوع للـ Capacitor عبر `useBackButton` الحالي.
- **RTL:** كل المواضع تُحسب مع `isRtl`؛ الأسهم والانتقالات معكوسة.
- **الأداء:** بدون مكتبات خارجية (لا driver.js/shepherd) لتقليل الحجم؛ مكوّنات خفيفة (~5KB gzipped).
- **الأنيميشن:** open 120ms / close 90ms، fade + scale خفيف، متوافق مع معيار `mem://style/animation-speed-standard`.
- **تكامل الشل:** تعديل `AppSettingsSheet.tsx` لتمرير بند «دليل الاستخدام» بشكل موحّد، أو استقبال `extraItems` كـ prop اختياري (الأقل تدخّلاً).
- **نصوص:** إضافة قسم `help.*` في `src/locales/ar.ts` لكل النصوص (عناوين، أوصاف، أزرار).

## الملفات المنشأة/المعدّلة

**جديدة:**
- `src/features/help/HelpProvider.tsx`
- `src/features/help/useOnboarding.ts`
- `src/features/help/helpContent.ts`
- `src/features/help/components/GuidedTour.tsx`
- `src/features/help/components/HelpDot.tsx`
- `src/features/help/components/HelpCenterSheet.tsx`
- `src/features/help/index.ts`

**تعديلات:**
- `src/App.tsx` — لفّ التطبيق بـ `HelpProvider` + تركيب `GuidedTour` مرة واحدة.
- `src/components/shell/AppSettingsSheet.tsx` — دعم بند «دليل الاستخدام».
- `src/features/owner/components/OwnerSettingsSheet.tsx` — نفس البند.
- `src/features/owner/components/OwnerDashboard.tsx` — إضافة سمات `data-tour` على الأزرار الرئيسية + بدء الجولة عند أول دخول.
- `src/features/accountant/components/AccountantDashboard.tsx` — نفس الشيء.
- `src/features/distributor/components/DistributorDashboard.tsx` — نفس الشيء.
- `src/locales/ar.ts` — إضافة قسم `help` كامل.

## معايير القبول
- عند أول تسجيل دخول لأي دور: تبدأ الجولة تلقائياً وتُغطّي كل الأزرار الأساسية للدور.
- بعد إتمامها أو تخطّيها: لا تعود إلا يدوياً من الإعدادات → «دليل الاستخدام» → «إعادة تشغيل الجولة».
- «مركز المساعدة» متاح دائماً من الإعدادات لكل الأدوار.
- تعمل بسلاسة على 360px و Tablet و Desktop، وعلى Capacitor مع زر الرجوع.
- صفر تأثير على منطق الأعمال أو قاعدة البيانات.
