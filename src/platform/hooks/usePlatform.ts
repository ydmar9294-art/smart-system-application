import { Capacitor } from '@capacitor/core';

export const usePlatform = () => {
  const getPlatform = () => Capacitor.getPlatform();
  const isNative = () => Capacitor.isNativePlatform();
  const isIOS = () => getPlatform() === 'ios';
  const isAndroid = () => getPlatform() === 'android';

  const getDeviceInfo = async () => {
    if (!isNative()) return null;
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      return info;
    } catch (error) {
      console.error('Device info error:', error);
      return null;
    }
  };

  return { getPlatform, isNative, isIOS, isAndroid, getDeviceInfo };
};
