import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const useHaptics = () => {
  const isNative = Capacitor.isNativePlatform();

  const impact = async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.error('Haptic impact error:', error);
    }
  };

  const notification = async (type: NotificationType = NotificationType.Success) => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type });
    } catch (error) {
      console.error('Haptic notification error:', error);
    }
  };

  const selection = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (error) {
      console.error('Haptic selection error:', error);
    }
  };

  const vibrate = async (duration: number = 300) => {
    if (!isNative) return;
    try {
      await Haptics.vibrate({ duration });
    } catch (error) {
      console.error('Haptic vibrate error:', error);
    }
  };

  return { impact, notification, selection, vibrate };
};
