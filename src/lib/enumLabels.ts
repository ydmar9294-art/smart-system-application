/**
 * Enum Label Mappings (Arabic)
 * مرجع مركزي لتحويل قيم الـ enums التقنية إلى نصوص عربية واضحة للواجهة.
 * يجب عدم عرض أي enum value خام (مثل FIELD_AGENT, OWNER) في الـ UI.
 */

// ─────────── Employee Types ───────────
// Note: WAREHOUSE_KEEPER and SALES_MANAGER were removed from the system.
// Only FIELD_AGENT and ACCOUNTANT are valid for new accounts.
export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  FIELD_AGENT: 'موزع ميداني',
  ACCOUNTANT: 'محاسب',
};

export const employeeTypeLabel = (type?: string | null): string =>
  type ? EMPLOYEE_TYPE_LABELS[type] ?? type : '';

// ─────────── Roles ───────────
export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالك',
  EMPLOYEE: 'موظف',
  DEVELOPER: 'مطوّر',
};

export const roleLabel = (role?: string | null): string =>
  role ? ROLE_LABELS[role] ?? role : '';

// ─────────── License Types & Status ───────────
export const LICENSE_TYPE_LABELS: Record<string, string> = {
  TRIAL: 'تجريبي',
  PAID: 'مدفوع',
  PERMANENT: 'دائم',
};

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  READY: 'جاهز',
  ACTIVE: 'فعّال',
  EXPIRED: 'منتهي',
  SUSPENDED: 'موقوف',
  PENDING: 'قيد الانتظار',
};

export const licenseTypeLabel = (t?: string | null): string =>
  t ? LICENSE_TYPE_LABELS[t] ?? t : '';

export const licenseStatusLabel = (s?: string | null): string =>
  s ? LICENSE_STATUS_LABELS[s] ?? s : '';

// ─────────── Request / Approval Status ───────────
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'موافَق عليه',
  REJECTED: 'مرفوض',
  EXECUTED: 'منفّذ',
  CANCELLED: 'ملغى',
};

export const requestStatusLabel = (s?: string | null): string =>
  s ? REQUEST_STATUS_LABELS[s] ?? s : '';

// ─────────── Payment Types ───────────
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CASH: 'نقدًا',
  CREDIT: 'آجل',
  PARTIAL: 'دفعة جزئية',
};

export const paymentTypeLabel = (t?: string | null): string =>
  t ? PAYMENT_TYPE_LABELS[t] ?? t : '';

// ─────────── Subscription Payment Status ───────────
export const SUBSCRIPTION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

export const subscriptionPaymentStatusLabel = (s?: string | null): string =>
  s ? SUBSCRIPTION_PAYMENT_STATUS_LABELS[s] ?? s : '';

// ─────────── Delivery Status ───────────
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد التحضير',
  in_transit: 'قيد التوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};

export const deliveryStatusLabel = (s?: string | null): string =>
  s ? DELIVERY_STATUS_LABELS[s] ?? s : '';

// ─────────── Route Stop Status ───────────
export const ROUTE_STOP_STATUS_LABELS: Record<string, string> = {
  pending: 'لم تُزَر',
  visited: 'تمّت الزيارة',
  skipped: 'متجاوزة',
};

export const routeStopStatusLabel = (s?: string | null): string =>
  s ? ROUTE_STOP_STATUS_LABELS[s] ?? s : '';

// ─────────── Customer Classification ───────────
export const CUSTOMER_CLASSIFICATION_LABELS: Record<string, string> = {
  A: 'فئة A — ممتاز',
  B: 'فئة B — جيد',
  C: 'فئة C — عادي',
};

export const customerClassificationLabel = (c?: string | null): string =>
  c ? CUSTOMER_CLASSIFICATION_LABELS[c] ?? c : '';

// ─────────── Generic helper ───────────
/**
 * Detect if a string looks like a raw enum (UPPER_SNAKE_CASE) — used in dev to warn.
 */
export const looksLikeRawEnum = (value: string): boolean =>
  /^[A-Z][A-Z0-9_]{2,}$/.test(value);
