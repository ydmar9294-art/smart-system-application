import { useState, useEffect, useCallback } from 'react';

/**
 * usePageTheme — manages dark/light mode globally.
 * Persists preference in localStorage and applies .dark on <html>.
 * Respects system preference as default.
 */
export function usePageTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('app-theme');
    if (stored) return stored === 'dark';
    // Default to light mode for new users
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Enable transition class before toggling
    root.classList.add('theme-transition');
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
    // Remove transition class after animation completes to avoid perf overhead
    const timer = setTimeout(() => root.classList.remove('theme-transition'), 350);
    return () => clearTimeout(timer);
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return { isDark, toggleTheme };
}
