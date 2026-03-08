/**
 * LanguageSwitcher — Modal for selecting app language
 * Options: Arabic, English, System Default
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Check, X, Smartphone } from 'lucide-react';
import { setStoredLang, getStoredLangPref } from '@/lib/i18n';

interface LanguageSwitcherProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'ar' as const, label: 'العربية', flag: '🇸🇦', dir: 'RTL' },
  { code: 'en' as const, label: 'English', flag: '🇺🇸', dir: 'LTR' },
] as const;

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ open, onClose }) => {
  const { i18n, t } = useTranslation();
  const [pref, setPref] = useState(getStoredLangPref);

  if (!open) return null;

  const handleSelect = (lang: 'ar' | 'en') => {
    setStoredLang(lang);
    setPref(lang);
    i18n.changeLanguage(lang);
    onClose();
  };

  const handleSystemDefault = () => {
    setStoredLang('system');
    setPref('system');
    // Detect system language
    const sysLang = navigator.language?.startsWith('ar') ? 'ar' : 'en';
    i18n.changeLanguage(sysLang);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md mx-2 mb-2 sm:mb-0 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div
          className="rounded-[2rem] overflow-hidden shadow-2xl"
          style={{
            background: 'var(--card-glass-bg, hsl(var(--card)))',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: '1px solid var(--card-glass-border, hsl(var(--border)))',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{t('settings.selectLanguage')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.currentLanguage')}: {pref === 'system' ? t('settings.languageSystem') : pref === 'ar' ? 'العربية' : 'English'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Language options */}
          <div className="px-5 pb-4 space-y-2.5">
            {LANGUAGES.map((lang) => {
              const isActive = pref === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                  style={{
                    background: isActive ? 'hsl(var(--primary) / 0.1)' : 'var(--card-glass-bg, hsl(var(--muted)))',
                    border: isActive ? '2px solid hsl(var(--primary))' : '1px solid var(--card-glass-border, hsl(var(--border)))',
                  }}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1 text-start">
                    <p className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>{lang.label}</p>
                    <p className="text-[11px] text-muted-foreground">{lang.dir}</p>
                  </div>
                  {isActive && <Check className="w-5 h-5 text-primary" />}
                </button>
              );
            })}

            {/* System Default */}
            <button
              onClick={handleSystemDefault}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: pref === 'system' ? 'hsl(var(--primary) / 0.1)' : 'var(--card-glass-bg, hsl(var(--muted)))',
                border: pref === 'system' ? '2px solid hsl(var(--primary))' : '1px solid var(--card-glass-border, hsl(var(--border)))',
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-start">
                <p className={`font-bold text-sm ${pref === 'system' ? 'text-primary' : 'text-foreground'}`}>{t('settings.languageSystem')}</p>
                <p className="text-[11px] text-muted-foreground">Auto-detect</p>
              </div>
              {pref === 'system' && <Check className="w-5 h-5 text-primary" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LanguageSwitcher;
