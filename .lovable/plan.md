

# خطة تحسين الأداء الشاملة — Smart System

## الملخص

تطبيق 6 مراحل تحسين لتقليل TTI من 8-15s إلى 3-5s على أجهزة Android 2GB RAM، مع الحفاظ الكامل على التوافقية.

---

## المرحلة 1: إلغاء تجميد المعالج الرئيسي (🔴 حرج)

### 1.1 — Web Worker للتشفير
- إنشاء `src/workers/crypto.worker.ts` مع دوال `encrypt`/`decrypt`
- تعديل `src/lib/indexedDbEncryption.ts`: تحويل `encryptData()` و `decryptData()` لإرسال العمليات إلى Worker عبر `postMessage` + Promise wrapper
- Fallback تلقائي للسلوك الحالي إذا فشل Worker
- لا تغيير في signatures أو خوارزمية التشفير

### 1.2 — تعطيل التشفير للبيانات غير الحساسة
- تعديل `src/lib/offlineCache.ts`: إضافة معامل `encrypt?: boolean` (افتراضي `true`)
- تعديل `src/hooks/useOfflineQuery.ts` أو أماكن استدعاء الكاش: تمرير `encrypt: false` لمفاتيح products, categories, regions, warehouses
- البيانات المالية (sales, payments, invoices) تبقى مشفرة

---

## المرحلة 2: تقليص الحزمة الأساسية (🔴 حرج)

### 2.1 — تأجيل framer-motion
**ملاحظة هامة**: بعد الفحص، `framer-motion` مستورد فقط في `AnimatedTabContent.tsx` وهو مستخدم داخل dashboards المحمّلة بـ `lazy()` أصلاً. أي أنه بالفعل في chunk منفصل (`vendor-motion`). التحسين هنا هو:
- تعديل `AnimatedTabContent.tsx` لاستخدام CSS transitions بدل framer-motion
- حذف `framer-motion` من dependencies بالكامل أو إبقاؤه كـ optional
- هذا يوفر ~41KB من أي chunk + يلغي وقت parse على الموبايل

### 2.2 — تقسيم ملفات الترجمة
- تعديل `src/lib/i18n.ts`: تحويل من static imports إلى `dynamic import()` حسب اللغة المختارة
- تحميل اللغة الحالية فقط عند الإقلاع
- Fallback: تحميل الاثنتين إذا فشل dynamic import

---

## المرحلة 3: إصلاح سلسلة إعادة الرسم (🟠 عالي)

### 3.1 — ترحيل المكونات من useApp() إلى hooks محددة
**الوضع الحالي**: `useApp()` مستخدم في 35 ملف. الـ contexts الثلاثة (Auth, Data, Notification) مفصولة فعلاً مع `useMemo` على DataContext.
- ترحيل أهم 10 مكونات لاستخدام `useAuth()` / `useData()` / `useNotifications()` بدل `useApp()`
- الأولوية: `Layout.tsx`, `App.tsx (MainContent)`, `ViewManager`, `NotificationCenter`, `AccountDeletionButton`
- `useApp()` يبقى يعمل بدون تغيير

### 3.2 — useMemo لقيمة AuthContext
- `DataContext` و `NotificationContext` بالفعل يستخدمان `useMemo`/`useCallback`
- تعديل `src/store/AuthContext.tsx`: تغليف `value` بـ `useMemo` (حالياً ينشئ object جديد كل render)

---

## المرحلة 4: إصلاحات خاصة بالموبايل (🟠 عالي)

### 4.1 — تقليل تكرار SecurityGate
- تعديل `src/components/SecurityGate.tsx`: إضافة `useRef(lastCheckTime)` مع حد أدنى 5 دقائق بين الفحوصات
- إزالة `clearSecurityCache()` عند كل resume

### 4.2 — إخفاء SplashScreen أسرع
- تعديل `src/main.tsx`: إخفاء SplashScreen فور mount بدل انتظار `window.load`
- أو ربطه بـ auth state (فور تحديد هل المستخدم مسجل أم لا)

---

## المرحلة 5: تحسين الذاكرة و IndexedDB (🟡 متوسط)

### 5.1 — إضافة Index في IndexedDB
- تعديل `src/lib/offlineCache.ts`: رفع `DB_VERSION` إلى 2، إضافة index على `updatedAt` في `onupgradeneeded`
- تحويل `cleanupExpiredCache()` لاستخدام `IDBKeyRange`

### 5.2 — تحديد حجم performanceMonitor Buffer
- تعديل `src/utils/monitoring/performanceMonitor.ts`: الحد الأقصى موجود فعلاً (200) مع `shift()`. تحسين بسيط: استخدام `splice(0, 50)` عند الوصول للحد بدل `shift()` لكل إضافة

### 5.3 — تنظيف Event Listeners
- مراجعة `App.tsx (MainContent)`: التأكد من cleanup لجميع listeners (الحالي يبدو صحيحاً — كل `useEffect` له return cleanup)

---

## المرحلة 6: تحسينات سريعة (🟢 منخفض)

### 6.1 — تقليص PWA Precache
- تعديل `vite.config.ts`: تقليل `maximumFileSizeToCacheInBytes` من 4MB إلى 1MB، تضييق `globPatterns`

### 6.2 — Skeleton لتبديل التبويبات
- تحسين `DashboardFallback` في `App.tsx` أو إضافة skeleton خفيف داخل `AnimatedTabContent`

---

## ملف Feature Flags
- إنشاء `src/config/performance.ts` مع أعلام تحكم لكل تحسين

## الملفات المتأثرة
| الملف | التغيير |
|-------|---------|
| `src/workers/crypto.worker.ts` | جديد — Web Worker |
| `src/lib/indexedDbEncryption.ts` | Worker delegation + fallback |
| `src/lib/offlineCache.ts` | encrypt flag + IDB index |
| `src/components/ui/AnimatedTabContent.tsx` | CSS transitions بدل framer-motion |
| `src/lib/i18n.ts` | Dynamic import للغة |
| `src/store/AuthContext.tsx` | useMemo للقيمة |
| `src/components/SecurityGate.tsx` | throttle 5 دقائق |
| `src/main.tsx` | SplashScreen سريع |
| `src/utils/monitoring/performanceMonitor.ts` | buffer splice |
| `vite.config.ts` | PWA precache limits |
| `src/config/performance.ts` | جديد — feature flags |
| `src/components/Layout.tsx` | useAuth() بدل useApp() |
| 5-8 مكونات أخرى | ترحيل من useApp() إلى hooks محددة |

## ترتيب التنفيذ
1. Feature flags file + تعطيل تشفير غير الحساس (1.2)
2. SplashScreen سريع (4.2) + SecurityGate throttle (4.1)
3. CSS transitions بدل framer-motion (2.1)
4. تقسيم i18n (2.2)
5. useMemo لـ AuthContext (3.2) + ترحيل useApp() (3.1)
6. Web Worker للتشفير (1.1)
7. IndexedDB index + buffer + PWA (5.x, 6.x)

