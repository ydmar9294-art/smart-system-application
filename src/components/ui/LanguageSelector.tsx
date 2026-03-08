import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, X, Languages } from 'lucide-react';
import { changeLanguage, getStoredPreference } from '@/i18n';

const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState(getStoredPreference);
  const [showModal, setShowModal] = useState(false);

  const options = [
    { value: 'ar', label: 'العربية', nativeLabel: 'Arabic', flag: '🇸🇾' },
    { value: 'en', label: 'English', nativeLabel: 'الإنجليزية', flag: '🇺🇸' },
    { value: 'system', label: t('language.systemDefault'), nativeLabel: '', flag: '🌐' },
  ];

  const currentLabel = options.find(o => o.value === preference)?.label
    || options.find(o => o.value === i18n.language)?.label
    || 'العربية';

  const handleChange = async (value: string) => {
    setPreference(value);
    await changeLanguage(value);
    // Delay closing so the user sees the check animation
    setTimeout(() => setShowModal(false), 250);
  };

  return (
    <>
      {/* Trigger button — shown in settings sheet */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold text-foreground transition-all active:scale-[0.98] native-glass-card"
      >
        <div className="flex items-center gap-3 relative z-[2]">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Languages className="w-4 h-4 text-primary" />
          </div>
          <div className="text-start">
            <p className="text-sm font-black">{t('language.title')}</p>
            <p className="text-[11px] text-muted-foreground font-bold">{currentLabel}</p>
          </div>
        </div>
        <Globe className="w-4 h-4 text-muted-foreground relative z-[2]" />
      </button>

      {/* Language selection modal */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          {/* Sheet */}
          <div className="relative w-full max-w-md mx-auto bg-background/95 backdrop-blur-2xl rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom-8 duration-300 border border-border/50">
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-5 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">{t('language.title')}</h2>
                  <p className="text-xs text-muted-foreground">{t('language.selectLanguage')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Language options */}
            <div className="space-y-2.5">
              {options.map((opt) => {
                const isActive = preference === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleChange(opt.value)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 active:scale-[0.97] border ${
                      isActive
                        ? 'bg-primary/8 border-primary/25 shadow-sm shadow-primary/10'
                        : 'bg-muted/30 border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{opt.flag}</span>
                      <div className="text-start">
                        <p className={`text-sm font-black ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {opt.label}
                        </p>
                        {opt.nativeLabel && (
                          <p className="text-[11px] text-muted-foreground font-bold">{opt.nativeLabel}</p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-50 duration-200">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hint */}
            <p className="text-center text-[10px] text-muted-foreground mt-5">
              {t('language.switchHint')}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default LanguageSelector;
