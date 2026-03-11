import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { logger } from '@/lib/logger';

export const usePlatform = () => {
  const getPlatform = () => Capacitor.getPlatform();
  const isNative = () => Capacitor.isNativePlatform();
  const isIOS = () => getPlatform() === 'ios';
  const isAndroid = () => getPlatform() === 'android';

  const getDeviceInfo = async () => {
    if (!isNative()) return null;
    try {
      const info = await Device.getInfo();
      return info;
    } catch {
      logger.error('Device info error', 'Platform');
      return null;
    }
  };

  return { getPlatform, isNative, isIOS, isAndroid, getDeviceInfo };
};
