/**
 * Centralized Error Handler
 * Provides consistent error handling and user-friendly messages
 */

// ============================================
// Error Message Translations
// ============================================

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'Failed to fetch': 'خطأ في الاتصال بالسيرفر',
  'Network Error': 'خطأ في الاتصال بالشبكة',
  'timeout': 'انتهت مهلة الاتصال',
  'User already registered': 'هذا البريد الإلكتروني مسجل مسبقاً',
  'Email not confirmed': 'لم يتم تأكيد البريد الإلكتروني',
  'Invalid token': 'جلسة غير صالحة، يرجى تسجيل الدخول مجدداً',
  'JWT expired': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
  'Insufficient stock': 'المخزون غير كافٍ',
  'Stock cannot be negative': 'لا يمكن أن يكون المخزون سالباً',
  'No organization found': 'لم يتم العثور على المنشأة',
  'Product not found': 'المنتج غير موجود',
  'Customer not found': 'العميل غير موجود',
  'Sale not found': 'الفاتورة غير موجودة',
  'License not found': 'الترخيص غير موجود',
  'License has expired': 'انتهت صلاحية الترخيص',
  'Activation code not found': 'كود التفعيل غير موجود أو مستخدم',
  'Unauthorized': 'غير مصرح بهذه العملية',
  'Sale is already voided': 'الفاتورة ملغية بالفعل',
  'Payment is already reversed': 'الدفعة معكوسة بالفعل',
  'Amount exceeds remaining balance': 'المبلغ أكبر من الرصيد المتبقي',
  'Cannot add collection to voided sale': 'لا يمكن إضافة تحصيل لفاتورة ملغية',
  'Cannot return items from voided sale': 'لا يمكن إرجاع أصناف من فاتورة ملغية'
};

/**
 * Translate technical error messages to user-friendly Arabic messages
 */
export const translateError = (message: string): string => {
  // Check for exact matches first
  if (ERROR_TRANSLATIONS[message]) {
    return ERROR_TRANSLATIONS[message];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(ERROR_TRANSLATIONS)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return original message if no translation found
  return message || 'حدث خطأ غير متوقع';
};

/**
 * Extract error message from various error types
 */
export const extractErrorMessage = (error: unknown): string => {
  if (!error) return 'حدث خطأ غير متوقع';

  // Supabase error format
  if (typeof error === 'object' && 'message' in error) {
    return translateError((error as { message: string }).message);
  }

  // Standard Error
  if (error instanceof Error) {
    return translateError(error.message);
  }

  // String error
  if (typeof error === 'string') {
    return translateError(error);
  }

  return 'حدث خطأ غير متوقع';
};

/**
 * Create a standardized error handler function
 */
export const createErrorHandler = (
  notifyFn: (message: string, type: 'error') => void,
  logPrefix: string = '[App Error]'
) => {
  return (error: unknown) => {
    console.error(logPrefix, error);
    const message = extractErrorMessage(error);
    notifyFn(message, 'error');
  };
};

/**
 * Timeout wrapper for async operations
 * Prevents infinite loading by enforcing a maximum wait time
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'انتهت مهلة العملية'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    })
  ]);
};

/**
 * Retry wrapper for failed operations
 * Useful for transient network errors
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  shouldRetry: (error: unknown) => boolean = () => true
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Safe JSON parse with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};
