/**
 * Safe Navigation Utility
 * Prevents XSS via open redirect attacks by validating navigation targets.
 * Only allows relative paths and same-origin URLs.
 */

/**
 * Checks if a URL/path is safe for navigation (not an open redirect).
 * Blocks javascript:, data:, external origins, and protocol-relative URLs.
 */
export const isSafeNavigationTarget = (to: string | undefined | null): boolean => {
  if (!to || typeof to !== 'string') return false;

  const trimmed = to.trim();

  // Block javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;

  // Block protocol-relative URLs (//evil.com)
  if (trimmed.startsWith('//')) return false;

  // Allow relative paths (starting with / or . or just a segment)
  if (trimmed.startsWith('/') || trimmed.startsWith('.') || trimmed.startsWith('#')) return true;

  // Allow hash-only navigation
  if (trimmed.startsWith('?')) return true;

  // Block absolute URLs to external origins
  try {
    const url = new URL(trimmed, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    // If URL parsing fails, it's likely a relative path segment
    return !trimmed.includes(':');
  }
};

/**
 * Sanitizes a navigation target. Returns '/' if the target is unsafe.
 */
export const sanitizeNavigationTarget = (to: string | undefined | null): string => {
  if (isSafeNavigationTarget(to)) return to!.trim();
  return '/';
};
