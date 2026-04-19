تحليل المشكلة

**1. بطء/تعليق التبديل بين الدارك/لايت مود:**

- في `src/index.css` (سطر 157-163): قاعدة CSS عامة جداً تطبّق `transition` على **كل عنصر** يحتوي على `bg-*`, `text-*`, `border-*` بمدة **350ms** — هذا يؤدي لانتقال آلاف العناصر دفعة واحدة عند تغيير `.dark`.
- إضافة لذلك سطر 173-184: قاعدة `html.theme-transition *` تستخدم `!important` على **كل العناصر مع `::before` و `::after**` — تضاعف الحمل وتتسبب بـ jank ولاج خصوصاً على الأجهزة الضعيفة (2GB RAM).
- النتيجة: تجميد UI لأكثر من ثانية أثناء التبديل.

**2. زر الإعدادات + ThemeToggle في الأعلى (داخل `Layout.tsx`):**

- `Layout.tsx` يضيف زر `ThemeToggle` و زر `Settings` (مع dropdown يحتوي: سياسة الخصوصية، الشروط، حذف الحساب) في **شريط ثابت أعلى الصفحة** (سطر 84-132).
- هذا الشريط يظهر فوق الـ `AppHeader` الجديد لجميع الأدوار (Owner, Distributor, Accountant, Warehouse, Developer) — ويتسبب بازدواجية بصرية ومخالفة لتصميم الـ Native الجديد.

---

## خطة التنفيذ

### 1) إصلاح أداء تبديل الثيم (`src/index.css` + `usePageTheme.ts`)

- **حذف القاعدة العامة** التي تطبّق transition على `[class*="bg-"], [class*="text-"], [class*="border-"]` (سطر 157-163) — استبدالها بقاعدة محصورة على `body` فقط.
- **حذف قاعدة `html.theme-transition ***` التي تستخدم `!important` على كل العناصر — استبدالها بقاعدة على `html, body` فقط (background + color)، مع مدة أقصر (150ms).
- في `usePageTheme.ts`: تقليل `setTimeout` من 350ms إلى 200ms، والاحتفاظ بنفس آلية toggle الفورية.
- النتيجة: التبديل يصبح فوري (<16ms) لأن المتصفح لن يحتاج لحساب transition لآلاف العناصر، فقط للـ root.

### 2) إزالة الأزرار العائمة من `Layout.tsx`

- حذف كامل لـ `<div className="sticky top-0 z-50 ...">` الذي يحتوي على `ThemeToggle` و زر Settings و dropdown (سطر 84-132).
- حذف import غير المستخدم: `ThemeToggle`, `Settings`, `Shield`, `FileText`, `AccountDeletionButton`, `useNavigate`, `showSettingsMenu` state.
- الإبقاء على `usePageTheme()` كـ hook فقط لأنه يطبّق الـ class على `<html>`.

### 3) دمج الخيارات داخل `AppSettingsSheet` (الشريط السفلي)

تعديل `src/components/shell/AppSettingsSheet.tsx` لإضافة قسم ثابت يظهر دائماً قبل قسم الدعم/الخروج، يحتوي:

- **مفتاح Dark/Light Mode**: صف بأيقونة Sun/Moon + Switch (يستخدم `usePageTheme`).
- **سياسة الخصوصية**: ينقل لـ `/privacy-policy`.
- **شروط الاستخدام**: ينقل لـ `/terms`.
- **حذف الحساب**: يستخدم `AccountDeletionButton` كما هو.

هذا يضمن ظهورها لكل الأدوار (Owner, Distributor, Accountant, Warehouse, Developer) دون تعديل كل لوحة على حدة، لأن كلها تستخدم نفس `AppSettingsSheet`.

لا اريد Backward compatiblitiy , اريد تطبيق كل ما سبق على جميع الواجهات

### 4) ضمان الاستقرار (Backward Compatibility)

- لا تعديل على `OwnerSettingsSheet` المخصص (يبقى كما هو لأن Owner يستخدم نسخته الخاصة) — لكن سنضيف نفس الخيارات الجديدة (Theme/Privacy/Terms/AccountDeletion) إليه أيضاً ليتطابق السلوك.
- `ThemeToggle.tsx` يبقى كمكون مستقل (لم يُحذف) — قد يستخدم لاحقاً.
- لا تغيير على API أو DB أو أي منطق sync/offline.

---

## الملفات المتأثرة


| الملف                                                  | التغيير                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/index.css`                                        | تقليص قاعدتي transition للثيم — حصرها على body فقط               |
| `src/hooks/usePageTheme.ts`                            | تقليل مدة transition إلى 200ms                                   |
| `src/components/Layout.tsx`                            | حذف الشريط العائم العلوي (ThemeToggle + Settings dropdown)       |
| `src/components/shell/AppSettingsSheet.tsx`            | إضافة قسم: Dark Mode toggle + Privacy + Terms + Account Deletion |
| `src/features/owner/components/OwnerSettingsSheet.tsx` | إضافة نفس القسم لتوحيد التجربة                                   |


---

## الاختبار

- اختبار التبديل بين الدارك/لايت من داخل الإعدادات السفلية لجميع الأدوار (Owner, Distributor, Accountant, Warehouse, Developer) — يجب أن يكون فوري وسلس.
- التحقق من اختفاء الزرين من أعلى كل واجهة.
- التحقق من عمل روابط الخصوصية/الشروط/حذف الحساب من داخل الإعدادات.