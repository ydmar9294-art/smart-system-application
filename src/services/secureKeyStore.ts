/**
 * Secure Key Store
 * 
 * Provides secure storage for encryption keys:
 * - Native (Android/iOS): Uses Capacitor Preferences with native encryption
 * - Web: Falls back to localStorage
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { logger } from '@/lib/logger';

const DEVICE_KEY_STORAGE = 'ss_dek_v2';
const KEY_CREATED_AT = 'ss_dek_created_at';
/** Maximum key age before rotation: 30 days */
const KEY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Retrieve the device encryption key from secure storage.
 */
export async function getSecureKey(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: DEVICE_KEY_STORAGE });
      return value;
    }
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
    const createdAt = Date.now().toString();
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: DEVICE_KEY_STORAGE, value: keyBase64 });
      await Preferences.set({ key: KEY_CREATED_AT, value: createdAt });
      return;
    }
    localStorage.setItem(DEVICE_KEY_STORAGE, keyBase64);
    localStorage.setItem(KEY_CREATED_AT, createdAt);
  } catch (err) {
    logger.error('Failed to store encryption key', 'SecureKeyStore');
    throw err;
  }
}

/**
 * Delete the device encryption key from secure storage.
 */
export async function deleteSecureKey(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: DEVICE_KEY_STORAGE });
      await Preferences.remove({ key: KEY_CREATED_AT });
    }
    localStorage.removeItem(DEVICE_KEY_STORAGE);
    localStorage.removeItem(KEY_CREATED_AT);
    localStorage.removeItem('ss_dek_v1');
  } catch (err) {
    logger.error('Failed to delete encryption key', 'SecureKeyStore');
  }
}

/**
 * Check if the device encryption key needs rotation (older than 30 days).
 */
export async function isKeyRotationNeeded(): Promise<boolean> {
  try {
    let createdAtStr: string | null = null;
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: KEY_CREATED_AT });
      createdAtStr = value;
    } else {
      createdAtStr = localStorage.getItem(KEY_CREATED_AT);
    }

    if (!createdAtStr) {
      const existingKey = await getSecureKey();
      return existingKey !== null;
    }

    const createdAt = parseInt(createdAtStr, 10);
    return Date.now() - createdAt > KEY_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * Rotate the device encryption key.
 */
export async function rotateSecureKey(): Promise<{ oldKeyB64: string | null; newKeyB64: string }> {
  const oldKey = await getSecureKey();
  const newKeyBuffer = crypto.getRandomValues(new Uint8Array(32));
  const newKeyB64 = btoa(String.fromCharCode(...newKeyBuffer));
  await storeSecureKey(newKeyB64);
  logger.info('Device encryption key rotated successfully', 'SecureKeyStore');
  return { oldKeyB64: oldKey, newKeyB64 };
}
