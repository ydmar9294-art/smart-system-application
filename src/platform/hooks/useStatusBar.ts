import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { usePageTheme } from '@/hooks/usePageTheme';
import { logger } from '@/lib/logger';

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
          color: '#00000000'
        });

        await StatusBar.show();

        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch {
        logger.error('Status bar initialization error', 'StatusBar');
      }
    };

    initializeStatusBar();
  }, [isDark]);
}
