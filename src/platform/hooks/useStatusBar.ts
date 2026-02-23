import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { usePageTheme } from '@/hooks/usePageTheme';

export function useStatusBar() {
  const { isDark } = usePageTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initializeStatusBar = async () => {
      try {
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light
        });

        await StatusBar.setBackgroundColor({
          color: isDark ? '#0f172a' : '#ffffff'
        });

        await StatusBar.show();
      } catch (error) {
        console.error('Status bar initialization error:', error);
      }
    };

    initializeStatusBar();
  }, [isDark]);
}
