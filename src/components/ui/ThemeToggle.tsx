import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { usePageTheme } from '@/hooks/usePageTheme';

const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = usePageTheme();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-xl
                 bg-card border border-border shadow-sm
                 text-foreground text-xs font-bold
                 transition-all duration-300 hover:shadow-md hover:scale-105 active:scale-95"
      aria-label={t('theme.toggleLabel')}
    >
      {isDark ? (
        <>
          <Sun size={16} className="text-warning" />
          <span className="hidden sm:inline">{t('theme.light')}</span>
        </>
      ) : (
        <>
          <Moon size={16} className="text-primary" />
          <span className="hidden sm:inline">{t('theme.dark')}</span>
        </>
      )}
    </button>
  );
};

export default ThemeToggle;
