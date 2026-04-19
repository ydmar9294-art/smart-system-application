/**
 * i18n entry point — Arabic-only.
 * 
 * The app no longer supports language switching. This file:
 *   1) Re-exports the Arabic-only i18n instance from the shim.
 *   2) Hard-locks `<html dir="rtl" lang="ar">` on load.
 *   3) Keeps backward-compatible exports (`setStoredLang`, `getStoredLangPref`,
 *      `applyLanguageDirection`) so existing callers do not break.
 */
import i18n from '@/lib/i18nShim';

// ============================================
// Backward-compatible language-pref API (no-ops)
// ============================================

export const setStoredLang = (_lang: 'ar' | 'en' | 'system') => {
  // No-op — language is permanently Arabic.
};

export const getStoredLangPref = (): 'ar' => 'ar';

// ============================================
// Apply RTL direction (locked to Arabic)
// ============================================

export const applyLanguageDirection = (_lang?: string) => {
  const html = document.documentElement;
  html.setAttribute('dir', 'rtl');
  html.setAttribute('lang', 'ar');
};

// Lock direction immediately on module load
if (typeof document !== 'undefined') {
  applyLanguageDirection();
}

export default i18n;
