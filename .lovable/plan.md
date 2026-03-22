

# خطة إصلاح المشاكل من تقرير التحليل الشامل

## المشاكل المطلوب حلها (مرتبة حسب الأولوية)

### 1. إضافة UNIQUE constraint على `devices(user_id, device_id)` 🔴
**المشكلة**: الـ upsert في `device-check` يعتمد على `onConflict: 'user_id,device_id'` بدون constraint فعلي في الـ schema — يمكن إنشاء صفوف مكررة عند race condition.

**الحل**: Migration تضيف `UNIQUE(user_id, device_id)` على جدول `devices`.

---

### 2. زيادة Heartbeat interval من 30s إلى 90s 🔴
**المشكلة**: 30s لكل مستخدم = 833 req/s عند 25K مستخدم. حمل غير مقبول.

**الحل**: تغيير `HEARTBEAT_INTERVAL_MS` في `useSessionHeartbeat.ts` من `30_000` إلى `90_000`.

---

### 3. إصلاح `useOfflineSync` — التحقق من FIELD_AGENT بدل EMPLOYEE 🟡
**المشكلة**: السطر 17 يتحقق من `userRole === 'EMPLOYEE'` وهذا يشمل كل الموظفين (محاسب، مدير مبيعات، أمين مستودع) بينما فقط FIELD_AGENT يحتاج الـ offline engine.

**الحل**: تغيير `useOfflineSync` ليقبل `employeeType` كـ parameter ويتحقق من `employeeType === 'FIELD_AGENT'` فقط.

---

### 4. تحسين `auth-status` — تخطي developer check لغير المطورين 🟡
**المشكلة**: `check_and_assign_developer_role` يُستدعى في **كل** طلب auth-status لكل المستخدمين، بينما هو مطلوب فقط لفحص المطورين الجدد.

**الحل**: استدعاء الـ RPC فقط إذا لم يكن الـ profile موجوداً أو إذا كان الـ email في allowlist. نعكس الترتيب: نجلب الـ profile أولاً، ثم نفحص developer فقط إذا لم يكن لديه role بعد.

---

### 5. إضافة `organization_id` لـ audit_logs في device-check 🟢
**المشكلة**: `device-check` يكتب audit_logs بدون `organization_id`.

**الحل**: جلب `organization_id` من `profiles` عند الـ register واستخدامه في audit_logs.

---

## ملخص الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| Migration جديدة | `UNIQUE(user_id, device_id)` على `devices` |
| `src/hooks/useSessionHeartbeat.ts` | interval: 30s → 90s |
| `src/hooks/useOfflineSync.ts` | parameter جديد `employeeType`, فحص `FIELD_AGENT` فقط |
| `supabase/functions/auth-status/index.ts` | إعادة ترتيب: profile أولاً ثم developer check مشروط |
| `supabase/functions/device-check/index.ts` | إضافة `organization_id` في audit_logs |
| الملفات التي تستدعي `useOfflineSync` | تمرير `employeeType` |

## ترتيب التنفيذ
1. Migration (UNIQUE constraint)
2. `useSessionHeartbeat.ts` (سطر واحد)
3. `useOfflineSync.ts` + callers
4. `auth-status` Edge Function
5. `device-check` Edge Function

