import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

// capacitor-native-biometric types
let NativeBiometric: any = null;

const loadBiometric = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('capacitor-native-biometric');
    NativeBiometric = mod.NativeBiometric;
    return NativeBiometric;
  } catch {
    return null;
  }
};

export const useBiometricAuth = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<number | null>(null);

  const checkAvailability = async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsAvailable(false);
      return false;
    }

    try {
      const bio = await loadBiometric();
      if (!bio) { setIsAvailable(false); return false; }
      const result = await bio.checkBiometry();
      setIsAvailable(result.isAvailable);
      setBiometricType(result.biometryType);
      return result.isAvailable;
    } catch (error) {
      console.error('Biometric check error:', error);
      setIsAvailable(false);
      return false;
    }
  };

  const authenticate = async (reason: string = 'Authenticate to continue') => {
    if (!isAvailable || !NativeBiometric) {
      throw new Error('Biometric authentication not available');
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Authentication Required',
        subtitle: 'Use your biometric to continue',
        description: '',
        negativeButtonText: 'Cancel'
      });
      return true;
    } catch (error: any) {
      if (error.message?.includes('cancel')) return false;
      throw error;
    }
  };

  const setCredentials = async (username: string, password: string) => {
    if (!isAvailable || !NativeBiometric) return;
    try {
      await NativeBiometric.setCredentials({ username, password, server: 'smart-system' });
    } catch (error) {
      console.error('Set credentials error:', error);
    }
  };

  const getCredentials = async () => {
    if (!isAvailable || !NativeBiometric) return null;
    try {
      return await NativeBiometric.getCredentials({ server: 'smart-system' });
    } catch (error) {
      console.error('Get credentials error:', error);
      return null;
    }
  };

  const deleteCredentials = async () => {
    if (!isAvailable || !NativeBiometric) return;
    try {
      await NativeBiometric.deleteCredentials({ server: 'smart-system' });
    } catch (error) {
      console.error('Delete credentials error:', error);
    }
  };

  return {
    isAvailable,
    biometricType,
    checkAvailability,
    authenticate,
    setCredentials,
    getCredentials,
    deleteCredentials
  };
};
