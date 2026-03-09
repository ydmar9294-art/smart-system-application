/**
 * IndexedDB Encryption Layer
 * 
 * Encrypts sensitive data before storing in IndexedDB using AES-GCM.
 * Key is derived from a random device key stored via secure key store
 * (native Keystore/Keychain on mobile, localStorage fallback on web).
 * 
 * If Web Crypto API is unavailable, sensitive offline storage is DISABLED
 * rather than using weak encryption. This prevents false security guarantees.
 */

import { logger } from '@/lib/logger';

const ALGO = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

// ============================================
// Key Management
// ============================================

let cachedKey: CryptoKey | null = null;

function isWebCryptoAvailable(): boolean {
  try {
    return !!(
      typeof crypto !== 'undefined' &&
      crypto.subtle &&
      typeof crypto.subtle.encrypt === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Get or create the device encryption key using the secure key store.
 * On native platforms, keys are stored in Android Keystore / iOS Keychain.
 * On web, keys fall back to localStorage (acceptable for browser context).
 */
async function getDeviceKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  // Dynamically import to avoid circular dependencies
  const { getSecureKey, storeSecureKey } = await import('@/services/secureKeyStore');
  
  const storedKeyB64 = await getSecureKey();

  if (storedKeyB64) {
    const rawKey = base64ToBuffer(storedKeyB64);
    cachedKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
    );
  } else {
    // Generate new random 256-bit key
    cachedKey = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 }, true, ['encrypt', 'decrypt']
    );
    // Export and persist via secure store
    const exported = await crypto.subtle.exportKey('raw', cachedKey);
    await storeSecureKey(bufferToBase64(exported));
  }

  return cachedKey;
}

// ============================================
// Buffer <-> Base64 Helpers
// ============================================

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================
// HMAC Integrity (for offline queue)
// ============================================

/**
 * Compute HMAC-SHA256 of data using the device encryption key material.
 */
export async function computeHMAC(data: string): Promise<string> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto unavailable — cannot compute HMAC');
  }

  const { getSecureKey } = await import('@/services/secureKeyStore');
  const keyB64 = await getSecureKey();
  if (!keyB64) throw new Error('No device key available for HMAC');

  const keyBuffer = base64ToBuffer(keyB64);
  const hmacKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const dataBuffer = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign('HMAC', hmacKey, dataBuffer);
  return bufferToBase64(signature);
}

/**
 * Verify HMAC-SHA256 signature.
 */
export async function verifyHMAC(data: string, expectedSignature: string): Promise<boolean> {
  try {
    const computed = await computeHMAC(data);
    // Constant-time comparison
    if (computed.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < computed.length; i++) {
      result |= computed.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

// ============================================
// Public API
// ============================================

export interface EncryptedPayload {
  __encrypted: true;
  /** IV + ciphertext, base64-encoded */
  data: string;
  /** Algorithm used */
  algo: 'aes-gcm';
}

/**
 * Check if Web Crypto is available for encryption.
 * UI should check this before attempting offline storage of sensitive data.
 */
export function isEncryptionAvailable(): boolean {
  return isWebCryptoAvailable();
}

/**
 * Encrypt a JSON-serializable object.
 * Returns an EncryptedPayload that can be stored in IndexedDB.
 * 
 * THROWS if Web Crypto is unavailable — caller must handle gracefully.
 */
export async function encryptData<T>(obj: T): Promise<EncryptedPayload> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API unavailable — cannot encrypt data. Sensitive offline storage is disabled.');
  }

  const json = JSON.stringify(obj);
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(json);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return {
    __encrypted: true,
    data: bufferToBase64(combined.buffer),
    algo: 'aes-gcm',
  };
}

/**
 * Decrypt an EncryptedPayload back to the original object.
 * Gracefully handles unencrypted data (returns as-is for backward compatibility).
 */
export async function decryptData<T>(stored: any): Promise<T> {
  // If not encrypted (legacy data), return as-is
  if (!stored || !stored.__encrypted) {
    return stored as T;
  }

  const payload = stored as EncryptedPayload;

  if (payload.algo === 'aes-gcm' && isWebCryptoAvailable()) {
    try {
      const key = await getDeviceKey();
      const combined = new Uint8Array(base64ToBuffer(payload.data));
      const iv = combined.slice(0, IV_LENGTH);
      const ciphertext = combined.slice(IV_LENGTH);

      const decrypted = await crypto.subtle.decrypt(
        { name: ALGO, iv },
        key,
        ciphertext
      );

      const json = new TextDecoder().decode(decrypted);
      return JSON.parse(json) as T;
    } catch (err) {
      logger.error('Decryption failed', 'Encryption');
      throw new Error('فشل فك تشفير البيانات المحلية');
    }
  }

  // Legacy obfuscated data — attempt migration by returning raw
  if ((payload as any).algo === 'obfuscated') {
    logger.warn('Found legacy obfuscated data — returning raw for migration', 'Encryption');
    return stored as T;
  }

  // Unknown algo
  return stored as T;
}

/**
 * Check if an object is an encrypted payload.
 */
export function isEncrypted(obj: any): obj is EncryptedPayload {
  return obj && obj.__encrypted === true && typeof obj.data === 'string';
}

/**
 * Clear the device encryption key from memory and secure storage.
 * Should be called on logout to ensure data is irrecoverable.
 */
export async function clearEncryptionKey(): Promise<void> {
  cachedKey = null;
  try {
    const { deleteSecureKey } = await import('@/services/secureKeyStore');
    await deleteSecureKey();
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Check if the encryption key needs rotation and perform it if so.
 * Re-imports the new key into the CryptoKey cache.
 * Returns true if rotation occurred.
 */
export async function checkAndRotateKeyIfNeeded(): Promise<boolean> {
  if (!isWebCryptoAvailable()) return false;

  try {
    const { isKeyRotationNeeded, rotateSecureKey } = await import('@/services/secureKeyStore');
    const needsRotation = await isKeyRotationNeeded();
    if (!needsRotation) return false;

    const { newKeyB64 } = await rotateSecureKey();
    // Reset cached CryptoKey so next operation uses the new key
    cachedKey = null;
    // Pre-warm the new key
    const rawKey = base64ToBuffer(newKeyB64);
    cachedKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
    );
    logger.info('Encryption key rotated and re-imported', 'Encryption');
    return true;
  } catch (err) {
    logger.error('Key rotation check failed', 'Encryption');
    return false;
  }
}
