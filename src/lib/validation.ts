/**
 * Input Validation Utilities
 * Re-exports from safeQuery for backward compatibility + text sanitization
 */
export { validatePositiveNumber, validateRequiredString as validateRequired, validateUUID, validateNonEmptyArray } from '@/lib/safeQuery';

/**
 * Sanitize text input — removes dangerous characters and patterns.
 * Defends against XSS, HTML injection, javascript: URIs, and event handlers.
 */
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/<\/?[^>]+(>|$)/g, '')                      // Strip all HTML tags
    .replace(/javascript\s*:/gi, '')                       // Remove javascript: URIs
    .replace(/on\w+\s*=\s*(['"]?).*?\1/gi, '')             // Remove event handler attributes
    .replace(/data\s*:\s*text\/html/gi, '')                 // Block data:text/html URIs
    .replace(/&#x?[0-9a-f]+;?/gi, '')                      // Remove HTML entities (encoded XSS)
    .replace(/\x00/g, '')                                  // Remove null bytes
    .slice(0, 500); // Max length guard
};

/**
 * Sanitize phone number
 */
export const sanitizePhone = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 20);
};

/**
 * Validate that a URL is safe (no javascript:, data:, vbscript: schemes)
 */
export const isSafeUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const normalized = url.trim().toLowerCase();
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'blob:'];
  return !dangerousSchemes.some(scheme => normalized.startsWith(scheme));
};
