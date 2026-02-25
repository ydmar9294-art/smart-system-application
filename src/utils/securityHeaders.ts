/**
 * Security Headers Utility
 * Note: CSP is NOT applied client-side when running in Capacitor WebView
 * as it can interfere with native bridge communication.
 * CSP should be configured server-side for web deployments.
 */

/**
 * Hash a string using SHA-256 for rate limiting
 * Used to hash IPs and emails for login attempt tracking
 */
export const hashString = async (str: string): Promise<string> => {
  // Use crypto.subtle if available (Web, modern Android)
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple hash for Android WebView without crypto.subtle
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Generate a fingerprint for rate limiting (IP-like identifier)
 * Since we can't get real IP in browser, we use a combination of factors
 */
export const generateClientFingerprint = async (): Promise<string> => {
  const factors = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '0'
  ].join('|');
  
  return hashString(factors);
};
