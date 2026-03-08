import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from '@/locales/ar';
import en from '@/locales/en';

const LANG_STORAGE_KEY = 'smart_system_lang';

// Get stored preference or null
const getStoredLang = (): string | null => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
    if (stored === 'system') return null; // let detector decide
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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: getStoredLang() || undefined, // Use stored lang or let detector decide
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['navigator'],
      caches: [],
    },
    react: {
      useSuspense: false,
    },
  });

// Apply dir attribute and lang-transition class
export const applyLanguageDirection = (lang: string) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const html = document.documentElement;
  
  // Add transition class for smooth switch
  html.classList.add('lang-transition');
  html.setAttribute('dir', dir);
  html.setAttribute('lang', lang);
  
  // Remove transition class after animation
  setTimeout(() => html.classList.remove('lang-transition'), 400);
};

// Set initial direction
applyLanguageDirection(i18n.language || 'ar');

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  applyLanguageDirection(lng);
});

export default i18n;
