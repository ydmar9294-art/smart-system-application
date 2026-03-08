/**
 * Secure Key Store
 * 
 * Provides secure storage for encryption keys:
 * - Native (Android/iOS): Uses Capacitor Preferences with native encryption
 *   (Android Keystore-backed EncryptedSharedPreferences via Capacitor)
 * - Web: Falls back to localStorage (acceptable for browser context where
 *   the OS provides the security boundary)
 * 
 * This abstraction ensures encryption keys are stored using the most
 * secure mechanism available on each platform.
 */

import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

const DEVICE_KEY_STORAGE = 'ss_dek_v2';

/**
 * Retrieve the device encryption key from secure storage.
 */
export async function getSecureKey(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Preferences (backed by Android Keystore / iOS Keychain encryption)
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: DEVICE_KEY_STORAGE });
      return value;
    }
    // Web fallback: localStorage
    return localStorage.getItem(DEVICE_KEY_STORAGE);
  } catch (err) {
    logger.error('Failed to retrieve encryption key', 'SecureKeyStore');
    return null;
  }
}

/**
 * Store the device encryption key in secure storage.
 */
export async function storeSecureKey(keyBase64: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: DEVICE_KEY_STORAGE, value: keyBase64 });
      return;
    }
    localStorage.setItem(DEVICE_KEY_STORAGE, keyBase64);
  } catch (err) {
    logger.error('Failed to store encryption key', 'SecureKeyStore');
    throw err;
  }
}

/**
 * Delete the device encryption key from secure storage.
 * Called on logout to make encrypted data irrecoverable.
 */
export async function deleteSecureKey(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: DEVICE_KEY_STORAGE });
    }
    // Always clear localStorage too (migration safety)
    localStorage.removeItem(DEVICE_KEY_STORAGE);
    // Also clear legacy v1 key
    localStorage.removeItem('ss_dek_v1');
  } catch (err) {
    logger.error('Failed to delete encryption key', 'SecureKeyStore');
  }
}
