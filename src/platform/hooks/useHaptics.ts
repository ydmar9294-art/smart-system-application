import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { logger } from '@/lib/logger';

export const useHaptics = () => {
  const isNative = Capacitor.isNativePlatform();

  const impact = async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style });
    } catch {
      logger.warn('Haptic impact error', 'Haptics');
    }
  };

  const notification = async (type: NotificationType = NotificationType.Success) => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type });
    } catch {
      logger.warn('Haptic notification error', 'Haptics');
    }
  };

  const selection = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch {
      logger.warn('Haptic selection error', 'Haptics');
    }
  };

  const vibrate = async (duration: number = 300) => {
    if (!isNative) return;
    try {
      await Haptics.vibrate({ duration });
    } catch {
      logger.warn('Haptic vibrate error', 'Haptics');
    }
  };

  return { impact, notification, selection, vibrate };
};
