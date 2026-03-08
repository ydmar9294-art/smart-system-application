import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { changeLanguage, getStoredPreference } from '@/i18n';

const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = React.useState(getStoredPreference);

  const options = [
    { value: 'ar', label: t('language.arabic'), flag: '🇸🇾' },
    { value: 'en', label: t('language.english'), flag: '🇺🇸' },
    { value: 'system', label: t('language.systemDefault'), flag: '🌐' },
  ];

  const handleChange = async (value: string) => {
    setPreference(value);
    await changeLanguage(value);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-sm font-black text-foreground">{t('language.title')}</span>
      </div>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const isActive = preference === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{opt.flag}</span>
                <span>{opt.label}</span>
              </div>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSelector;
