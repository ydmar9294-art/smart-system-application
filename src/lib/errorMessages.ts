/**
 * errorMessages — convert raw Postgres / Supabase errors to clear Arabic messages.
 * 
 * Backward-compatible utility: existing toast/error calls continue to work.
 * New code may opt-in by wrapping errors with `formatError()`.
 */

const PG_CODE_MAP: Record<string, string> = {
  '23505': 'هذه البيانات مسجّلة مسبقاً',
  '23503': 'لا يمكن تنفيذ العملية: مرجع غير موجود',
  '23502': 'حقل مطلوب مفقود',
  '23514': 'البيانات لا تستوفي الشروط المطلوبة',
  '42501': 'لا تملك صلاحية تنفيذ هذه العملية',
  'PGRST116': 'العنصر المطلوب غير موجود',
  '22P02': 'صيغة البيانات غير صحيحة',
  '40001': 'تعارض في البيانات، حاول مرة أخرى',
  '57014': 'انتهت مهلة العملية، حاول لاحقاً',
};

const PATTERN_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /duplicate key/i,                   message: 'هذه البيانات مسجّلة مسبقاً' },
  { pattern: /violates foreign key/i,            message: 'لا يمكن تنفيذ العملية: مرجع غير موجود' },
  { pattern: /violates not-null/i,               message: 'حقل مطلوب مفقود' },
  { pattern: /permission denied|not authorized/i,message: 'لا تملك صلاحية تنفيذ هذه العملية' },
  { pattern: /row-level security/i,              message: 'لا تملك صلاحية الوصول لهذه البيانات' },
  { pattern: /jwt|invalid token|expired/i,       message: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً' },
  { pattern: /network|fetch failed|failed to fetch/i, message: 'تعذّر الاتصال بالخادم، تحقق من الإنترنت' },
  { pattern: /timeout|timed out/i,               message: 'انتهت مهلة العملية، حاول لاحقاً' },
  { pattern: /rate limit/i,                      message: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة' },
  { pattern: /max.*employees|distributors/i,     message: 'تم الوصول للحد الأقصى من الموزعين النشطين' },
  { pattern: /insufficient stock|out of stock/i, message: 'المخزون غير كافٍ' },
  { pattern: /license.*expired|subscription.*expired/i, message: 'انتهت صلاحية الاشتراك' },
  { pattern: /device.*revoked|session.*invalid/i,message: 'تم تسجيل الدخول من جهاز آخر' },
];

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Convert any error (PG, Supabase, generic) to a clear Arabic message.
 */
export function formatError(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (!error) return fallback;
  if (typeof error === 'string') {
    return matchPattern(error) ?? error;
  }

  const e = error as ErrorLike;

  // 1) Postgres code lookup
  if (e.code && PG_CODE_MAP[e.code]) {
    return PG_CODE_MAP[e.code];
  }

  // 2) Pattern matching on message
  const msg = e.message ?? e.details ?? e.hint ?? '';
  const matched = matchPattern(msg);
  if (matched) return matched;

  // 3) If the raw message is short Arabic, return it as-is (it's likely from our RPCs)
  if (msg && /[\u0600-\u06FF]/.test(msg) && msg.length < 200) {
    return msg;
  }

  return fallback;
}

function matchPattern(text: string): string | null {
  for (const { pattern, message } of PATTERN_MAP) {
    if (pattern.test(text)) return message;
  }
  return null;
}
