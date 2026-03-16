

# خطة تكامل Smart System مع برنامج الأمين للمحاسبة

## ملخص المعمارية

```text
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Smart System      │     │   Desktop Bridge     │     │  برنامج الأمين  │
│   (Web/Capacitor)   │     │   (Windows App)      │     │  (Windows)      │
│                     │     │                      │     │                 │
│ توليد القيود ──────────→ تنزيل Excel/CSV ──────────→ Import رسمي    │
│ من الفواتير         │     │ فحص + تحقق           │     │ Entry Vouchers  │
│ المرتجعات           │     │ Retry عند الفشل      │     │                 │
│ التحصيلات           │     │ سجل الاستيراد        │     │                 │
│ المخزون             │     │                      │     │                 │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
        ↕ Supabase                    ↕ File System
┌─────────────────────┐     ┌──────────────────────┐
│ journal_entries      │     │ مجلد محلي مراقب     │
│ journal_entry_items  │     │ (File Watcher)       │
│ al_ameen_exports     │     │                      │
└─────────────────────┘     └──────────────────────┘
```

## القيود التقنية المهمة

- **Lovable.dev = Web/Capacitor فقط** — لا يمكنه بناء Desktop Bridge مباشرة
- برنامج الأمين يعمل على Windows فقط ويستخدم قاعدة بيانات محلية (Firebird/SQL Server)
- التكامل الآمن يتم عبر **ملفات Excel/CSV** بصيغة Import الرسمية للأمين — بدون تعديل مباشر على قاعدة بياناته

## ما يمكن بناؤه داخل Lovable (Smart System)

### المرحلة 1: نظام القيود المحاسبية (Journal Entries)

**جداول جديدة في Supabase:**

- `journal_entries`: id, organization_id, entry_number, entry_date, description, source_type (sale/return/collection/inventory), source_id, total_debit, total_credit, status (draft/confirmed/exported), exported_at, created_at
- `journal_entry_lines`: id, entry_id, account_code, account_name, debit, credit, description, cost_center
- `al_ameen_exports`: id, organization_id, file_name, file_url, entries_count, status (pending/downloaded/imported/failed), error_message, created_at, downloaded_at, imported_at
- `al_ameen_account_map`: id, organization_id, smart_account_type (sales_revenue/cost_of_goods/customer_receivable/cash/inventory/returns), al_ameen_code, al_ameen_name — لربط حسابات Smart System بأكواد الأمين

**منطق توليد القيود التلقائي:**

| العملية | مدين | دائن |
|---------|------|------|
| بيع نقدي | الصندوق | إيراد المبيعات |
| بيع آجل | ذمم العملاء | إيراد المبيعات |
| تحصيل | الصندوق | ذمم العملاء |
| مرتجع مبيعات | مردودات المبيعات | ذمم العملاء / الصندوق |
| مرتجع مشتريات | المورد | مردودات المشتريات |
| تسليم مخزون لمندوب | مخزون المندوب | المستودع الرئيسي |

- يتم توليد القيود تلقائياً عند إنشاء فاتورة/تحصيل/مرتجع عبر Database Triggers أو Edge Function
- القيد لا يُنشر حتى يؤكده المحاسب (status = confirmed)

### المرحلة 2: تصدير بصيغة الأمين

**Edge Function `export-journal`:**
- يجمع القيود المؤكدة غير المصدّرة
- يولد ملف Excel (xlsx) بالأعمدة المطلوبة للأمين:
  - رقم القيد، التاريخ، رقم الحساب، اسم الحساب، مدين، دائن، البيان، مركز التكلفة
- يرفع الملف إلى Supabase Storage
- يسجل في `al_ameen_exports`

**واجهة التصدير (تبويب جديد في لوحة المحاسب):**
- عرض القيود الجاهزة للتصدير
- زر "تصدير إلى الأمين" → يولد الملف ويتيح تنزيله
- سجل التصديرات السابقة مع حالة كل عملية
- إعدادات ربط الحسابات (Account Mapping)

### المرحلة 3: دعم Offline

- القيود تُخزن محلياً عبر `useOfflineQuery` الموجود
- عند عودة الاتصال تُزامن تلقائياً عبر `useOfflineMutationQueue`
- ملفات Excel المولّدة تُحفظ محلياً على Capacitor عبر `@capacitor/filesystem`

## ما يُبنى خارج Lovable (Desktop Bridge)

> هذا الجزء يحتاج تطوير منفصل — خارج نطاق Lovable

**تطبيق Windows صغير (Electron أو .NET):**
1. File Watcher يراقب مجلد محدد للملفات الجديدة
2. يفحص الملف: تطابق الأعمدة، صحة أكواد الحسابات، توازن المدين/الدائن
3. يستدعي وظيفة Import في الأمين (عبر COM Automation أو API إن وُجد)
4. يُبلغ Smart System بالنتيجة عبر Edge Function callback
5. Retry تلقائي عند الفشل (3 محاولات بفاصل تصاعدي)

## ملخص التنفيذ داخل Lovable

| العنصر | النوع | التفاصيل |
|--------|-------|---------|
| `journal_entries` + `journal_entry_lines` | Migration | جداول القيود مع RLS |
| `al_ameen_exports` + `al_ameen_account_map` | Migration | سجل التصدير وربط الحسابات |
| Database Triggers | Migration | توليد قيود تلقائي عند INSERT في sales/collections/returns |
| `export-journal` | Edge Function | توليد Excel وحفظه في Storage |
| تبويب "القيود والأمين" | React Component | في AccountantDashboard + OwnerDashboard |
| إعدادات ربط الحسابات | React Component | ضمن تبويب المحاسب |

## ترتيب التنفيذ

1. إنشاء جداول القيود وربط الحسابات
2. بناء منطق توليد القيود التلقائي (triggers)
3. واجهة عرض وتأكيد القيود
4. Edge Function لتوليد Excel
5. واجهة التصدير وسجل العمليات
6. دعم Offline للقيود

