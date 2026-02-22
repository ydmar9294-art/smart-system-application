/**
 * Input Validation Utilities
 * Re-exports from safeQuery for backward compatibility + text sanitization
 */
export { validatePositiveNumber, validateRequiredString as validateRequired, validateUUID, validateNonEmptyArray } from '@/lib/safeQuery';

/**
 * Sanitize text input - removes dangerous characters
 */
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML injection chars
    .slice(0, 500); // Max length guard
};

/**
 * Sanitize phone number
 */
export const sanitizePhone = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 20);
};
