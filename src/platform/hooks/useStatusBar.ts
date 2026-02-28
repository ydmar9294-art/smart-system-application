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

        // Match status bar background to app theme
        await StatusBar.setBackgroundColor({
          color: isDark ? '#0f172a' : '#f5f7fa'
        });

        // Ensure status bar is visible
        await StatusBar.show();

        // On Android, set overlay to false to prevent content from going behind status bar
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (error) {
        console.error('Status bar initialization error:', error);
      }
    };

    initializeStatusBar();
  }, [isDark]);
}
