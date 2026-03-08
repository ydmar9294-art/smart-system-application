import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import { logger } from '@/lib/logger';

export const useAppShortcuts = () => {
  const navigate = useNavigate();
  const { role } = useApp();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrl = async (data: { url: string }) => {
      try {
        const url = new URL(data.url);
        const path = url.pathname;

        if (path.startsWith('/sales')) {
          navigate('/#/sales');
        } else if (path.startsWith('/customers')) {
          navigate('/#/customers');
        } else if (path.startsWith('/inventory')) {
          navigate('/#/inventory');
        }
      } catch {
        logger.error('Deep link handling error', 'AppShortcuts');
      }
    };

    const listener = App.addListener('appUrlOpen', handleAppUrl);

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, role]);
};
