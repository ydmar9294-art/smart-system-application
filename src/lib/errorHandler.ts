/**
 * Centralized Error Handler
 * Provides consistent error handling with i18n support
 */
import i18n from '@/lib/i18n';
import { logger } from '@/lib/logger';

// ============================================
// Error Message Translation Keys
// ============================================

const ERROR_KEY_MAP: Record<string, string> = {
  'Invalid login credentials': 'errors.invalidCredentials',
  'Failed to fetch': 'errors.serverConnection',
  'Network Error': 'errors.networkError',
  'timeout': 'errors.timeout',
  'User already registered': 'errors.emailAlreadyRegistered',
  'Email not confirmed': 'errors.emailNotConfirmed',
  'Invalid token': 'errors.invalidToken',
  'JWT expired': 'errors.jwtExpired',
  'Insufficient stock': 'errors.insufficientStock',
  'Stock cannot be negative': 'errors.stockNegative',
  'No organization found': 'errors.noOrganization',
  'Product not found': 'errors.productNotFound',
  'Customer not found': 'errors.customerNotFound',
  'Sale not found': 'errors.saleNotFound',
  'License not found': 'errors.licenseNotFound',
  'License has expired': 'errors.licenseExpired',
  'Activation code not found': 'errors.activationCodeNotFound',
  'Unauthorized': 'errors.unauthorized',
  'Sale is already voided': 'errors.saleAlreadyVoided',
  'Payment is already reversed': 'errors.paymentAlreadyReversed',
  'Amount exceeds remaining balance': 'errors.amountExceedsBalance',
  'Cannot add collection to voided sale': 'errors.collectionOnVoidedSale',
  'Cannot return items from voided sale': 'errors.returnOnVoidedSale',
};

/**
 * Translate technical error messages using i18n keys
 */
export const translateError = (message: string): string => {
  // Check for exact matches first
  const key = ERROR_KEY_MAP[message];
  if (key && i18n.exists(key)) {
    return i18n.t(key);
  }

  // Check for partial matches
  for (const [pattern, translationKey] of Object.entries(ERROR_KEY_MAP)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      if (i18n.exists(translationKey)) {
        return i18n.t(translationKey);
      }
    }
  }

  // Return original message if no translation found
  return message || i18n.t('errors.unexpected');
};

/**
 * Extract error message from various error types
 */
export const extractErrorMessage = (error: unknown): string => {
  if (!error) return i18n.t('errors.unexpected');

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

  return i18n.t('errors.unexpected');
};

/**
 * Create a standardized error handler function
 */
export const createErrorHandler = (
  notifyFn: (message: string, type: 'error') => void,
  logPrefix: string = '[App Error]'
) => {
  return (error: unknown) => {
    logger.error(`${logPrefix} ${error instanceof Error ? error.message : String(error)}`, 'ErrorHandler');
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
  timeoutMessage?: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage || i18n.t('errors.operationTimeout'))), timeoutMs);
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
