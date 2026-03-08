import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar';
import en from './locales/en';

const LANGUAGE_STORAGE_KEY = 'smart_system_language';

const getStoredLanguage = (): string | null => {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { return null; }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: getStoredLanguage() || undefined,
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
  });

// Apply direction + smooth transition on language change
const applyDirection = (lng: string) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  const el = document.documentElement;

  // Add transition class for smooth language switch animation
  el.classList.add('lang-transition');
  
  el.dir = dir;
  el.lang = lng;
  el.setAttribute('data-lang', lng);

  // Remove transition class after animation completes
  requestAnimationFrame(() => {
    setTimeout(() => el.classList.remove('lang-transition'), 400);
  });
};

// Apply initial direction (no transition on first load)
const initDir = (i18n.language || 'ar') === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dir = initDir;
document.documentElement.lang = i18n.language || 'ar';
document.documentElement.setAttribute('data-lang', i18n.language || 'ar');

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  applyDirection(lng);
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lng); } catch {}
});

export const changeLanguage = async (lng: string) => {
  if (lng === 'system') {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    const detected = navigator.language?.startsWith('ar') ? 'ar' : 'en';
    await i18n.changeLanguage(detected);
  } else {
    await i18n.changeLanguage(lng);
  }
};

export const getCurrentLanguage = () => i18n.language;
export const isRTL = () => i18n.language === 'ar';
export const getStoredPreference = () => getStoredLanguage() || 'system';

export default i18n;
