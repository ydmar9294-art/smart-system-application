import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { PERF_FLAGS } from '@/config/performance';

const LANG_STORAGE_KEY = 'smart_system_lang';

// Get stored preference or null
const getStoredLang = (): string | null => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
    if (stored === 'system') return null;
    return null;
  } catch {
    return null;
  }
};

export const setStoredLang = (lang: 'ar' | 'en' | 'system') => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
};

export const getStoredLangPref = (): 'ar' | 'en' | 'system' => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en' || stored === 'system') return stored;
    return 'system';
  } catch {
    return 'system';
  }
};

/**
 * Load a language bundle dynamically.
 * Returns the translation object for the given language.
 */
async function loadLanguage(lang: string): Promise<Record<string, any>> {
  if (lang === 'ar') {
    const mod = await import('@/locales/ar');
    return mod.default;
  }
  const mod = await import('@/locales/en');
  return mod.default;
}

/**
 * Determine initial language before i18n init.
 */
function detectInitialLang(): string {
  const stored = getStoredLang();
  if (stored) return stored;
  // Detect from browser
  try {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang === 'ar') return 'ar';
  } catch {}
  return 'en';
}

const initialLang = detectInitialLang();

if (PERF_FLAGS.SPLIT_I18N) {
  // Dynamic i18n: load only the needed language at boot
  i18n
    .use(initReactI18next)
    .init({
      resources: {},
      lng: initialLang,
      fallbackLng: 'en',
      supportedLngs: ['ar', 'en'],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

  // Load initial language immediately
  loadLanguage(initialLang)
    .then(translations => {
      i18n.addResourceBundle(initialLang, 'translation', translations, true, true);
      // Trigger re-render for components already mounted
      i18n.changeLanguage(initialLang);
    })
    .catch(() => {
      // Fallback: load both synchronously
      import('@/locales/ar').then(ar => i18n.addResourceBundle('ar', 'translation', ar.default, true, true));
      import('@/locales/en').then(en => i18n.addResourceBundle('en', 'translation', en.default, true, true));
    });
} else {
  // Legacy mode: load both languages synchronously (fallback)
  // Note: these are static imports wrapped in dynamic for the else branch
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {},
      lng: getStoredLang() || undefined,
      fallbackLng: 'en',
      supportedLngs: ['ar', 'en'],
      interpolation: { escapeValue: false },
      detection: { order: ['navigator'], caches: [] },
      react: { useSuspense: false },
    });

  // Load both
  Promise.all([import('@/locales/ar'), import('@/locales/en')]).then(([ar, en]) => {
    i18n.addResourceBundle('ar', 'translation', ar.default, true, true);
    i18n.addResourceBundle('en', 'translation', en.default, true, true);
  });
}

// Lazy-load the other language when switching
const loadedLangs = new Set<string>([]);

i18n.on('languageChanged', async (lng) => {
  if (!loadedLangs.has(lng)) {
    try {
      const translations = await loadLanguage(lng);
      i18n.addResourceBundle(lng, 'translation', translations, true, true);
      loadedLangs.add(lng);
    } catch {}
  }
  applyLanguageDirection(lng);
});

// Mark initial language as loaded once it resolves
loadLanguage(initialLang).then(() => loadedLangs.add(initialLang)).catch(() => {});

// Apply dir attribute and lang-transition class
export const applyLanguageDirection = (lang: string) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const html = document.documentElement;
  
  html.classList.add('lang-transition');
  html.setAttribute('dir', dir);
  html.setAttribute('lang', lang);
  
  setTimeout(() => html.classList.remove('lang-transition'), 400);
};

// Set initial direction
applyLanguageDirection(initialLang);

export default i18n;
