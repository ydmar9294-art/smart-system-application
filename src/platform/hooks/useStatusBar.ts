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
        // Set style based on theme
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light
        });

        // Transparent status bar background for liquid-glass effect
        await StatusBar.setBackgroundColor({
          color: '#00000000'
        });

        // Ensure status bar is visible
        await StatusBar.show();

        // On Android, set overlay to true so content scrolls under status bar (liquid-glass style)
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch (error) {
        console.error('Status bar initialization error:', error);
      }
    };

    initializeStatusBar();
  }, [isDark]);
}
