/**
 * HTML Escape Utility
 * Prevents XSS attacks by escaping special characters in user-provided content
 * before inserting into HTML templates.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 */
export const escapeHtml = (str: string | null | undefined): string => {
  if (str == null) return '';
  
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Escapes a number for safe HTML insertion
 * Returns the localized string representation
 */
export const escapeNumber = (num: number | null | undefined): string => {
  if (num == null) return '0';
  return Number(num).toLocaleString();
};
