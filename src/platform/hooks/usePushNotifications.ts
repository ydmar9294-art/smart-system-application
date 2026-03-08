import { useEffect, useState } from 'react';
import { pushNotificationService } from '@/services/pushNotifications';
import { logger } from '@/lib/logger';

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
        logger.error('Push notification initialization error', 'PushNotifications');
      }
    };

    init();
  }, []);

  const sendTestNotification = async () => {
    try {
      await pushNotificationService.sendTestNotification();
    } catch {
      logger.error('Error sending test notification', 'PushNotifications');
    }
  };

  const showNotification = async (title: string, body: string, data?: Record<string, unknown>) => {
    try {
      await pushNotificationService.showLocalNotification({ title, body, data });
    } catch {
      logger.error('Error showing notification', 'PushNotifications');
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
