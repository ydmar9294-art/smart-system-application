

# Fix: Google OAuth لا يعود للتطبيق بعد تسجيل الدخول

## المشكلة
بعد إتمام تسجيل الدخول عبر Google في Chrome Custom Tab، صفحة الجسر (bridge page) تحاول فتح التطبيق عبر `window.location.href = 'smartsystem://...'` لكن Chrome على Android يحظر هذا النوع من الروابط المخصصة. النتيجة: المستخدم يبقى في المتصفح ولا يعود للتطبيق.

## الحل (تغييران رئيسيان)

### 1. تحديث صفحة الجسر لاستخدام Android Intent URL
**الملف:** `public/auth/callback/index.html`

بدلا من:
```
window.location.href = 'smartsystem://oauth-callback#...'
```

نستخدم صيغة Intent URL التي يدعمها Chrome على Android:
```
intent://oauth-callback#Intent;scheme=smartsystem;package=app.lovable.bac2f6ed2db54e828d262c37cac1581f;end
```

هذه الصيغة تجبر Chrome على فتح التطبيق المثبت مباشرة. كذلك نبقي الرابط المخصص كـ fallback للمتصفحات الأخرى.

### 2. إضافة مستمع إغلاق المتصفح في capacitorOAuth
**الملف:** `src/lib/capacitorOAuth.ts`

نضيف `Browser.addListener('browserFinished')` للتعامل مع الحالة التي يغلق فيها المستخدم المتصفح يدويا - نتحقق من الجلسة عند الإغلاق.

### 3. إصلاح مستمع Auth State في AppContext
**الملف:** `src/store/AppContext.tsx`

الشرط الحالي يمنع معالجة `SIGNED_IN` أثناء التهيئة:
```typescript
if (session?.user && event === 'SIGNED_IN' && !initializingAuth.current)
```

نضيف معالجة حدث `TOKEN_REFRESHED` أيضا، ونزيل شرط `!initializingAuth.current` لحدث `SIGNED_IN` القادم من deep link callback.

---

## التفاصيل التقنية

### تدفق OAuth المصحح:

```text
1. التطبيق يفتح Browser.open() --> Chrome Custom Tab
2. المستخدم يسجل دخول Google
3. Google يعيد التوجيه لصفحة الجسر (/auth/callback)
4. صفحة الجسر تستخدم Intent URL لفتح التطبيق
5. Android يفتح التطبيق مباشرة + يغلق Chrome Tab
6. Deep link listener يستقبل التوكنات ويضبط الجلسة
7. onAuthStateChange يكشف SIGNED_IN ويحمل الملف الشخصي
```

### الملفات المتأثرة:
- `public/auth/callback/index.html` - استخدام Intent URL بدل custom scheme
- `src/lib/capacitorOAuth.ts` - إضافة browserFinished listener
- `src/store/AppContext.tsx` - إصلاح شرط SIGNED_IN listener

