import { useEffect, useState } from 'react';
import { pushNotificationService } from '@/services/pushNotifications';

export const usePushNotifications = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await pushNotificationService.initialize();
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize push notifications');
        console.error('Push notification initialization error:', err);
      }
    };

    init();
  }, []);

  const sendTestNotification = async () => {
    try {
      await pushNotificationService.sendTestNotification();
    } catch (err) {
      console.error('Error sending test notification:', err);
    }
  };

  const showNotification = async (title: string, body: string, data?: Record<string, unknown>) => {
    try {
      await pushNotificationService.showLocalNotification({ title, body, data });
    } catch (err) {
      console.error('Error showing notification:', err);
    }
  };

  return {
    isInitialized,
    error,
    sendTestNotification,
    showNotification,
    deviceToken: pushNotificationService.getDeviceToken()
  };
};
