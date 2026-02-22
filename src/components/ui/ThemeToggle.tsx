import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { usePageTheme } from '@/hooks/usePageTheme';

/**
 * ThemeToggle — reusable dark/light mode toggle button.
 * Uses the usePageTheme hook for state + localStorage persistence.
 * Drop into any page header or toolbar.
 */
const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = usePageTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-xl
                 bg-card border border-border shadow-sm
                 text-foreground text-xs font-bold
                 transition-all duration-300 hover:shadow-md hover:scale-105 active:scale-95"
      aria-label="تبديل المظهر"
    >
      {isDark ? (
        <>
          <Sun size={16} className="text-warning" />
          <span className="hidden sm:inline">الوضع الفاتح</span>
        </>
      ) : (
        <>
          <Moon size={16} className="text-primary" />
          <span className="hidden sm:inline">الوضع الداكن</span>
        </>
      )}
    </button>
  );
};

export default ThemeToggle;
