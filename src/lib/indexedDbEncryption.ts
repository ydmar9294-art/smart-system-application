/**
 * IndexedDB Encryption Layer
 * 
 * Encrypts sensitive data before storing in IndexedDB using AES-GCM.
 * Key is derived from a random device key stored in localStorage,
 * separate from IndexedDB to add a layer of defense-in-depth.
 * 
 * If Web Crypto API is unavailable (some mobile WebViews),
 * falls back to a basic obfuscation layer rather than storing plaintext.
 */

const DEVICE_KEY_STORAGE = 'ss_dek_v1';
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

/** Get or generate a per-device encryption key */
async function getDeviceKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const stored = localStorage.getItem(DEVICE_KEY_STORAGE);

  if (stored) {
    // Import existing key
    const rawKey = base64ToBuffer(stored);
    cachedKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
    );
  } else {
    // Generate new random key
    cachedKey = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 }, true, ['encrypt', 'decrypt']
    );
    // Export and persist
    const exported = await crypto.subtle.exportKey('raw', cachedKey);
    localStorage.setItem(DEVICE_KEY_STORAGE, bufferToBase64(exported));
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
// Obfuscation Fallback (no Web Crypto)
// ============================================

function obfuscate(text: string): string {
  // Simple XOR + Base64 — NOT cryptographic, just prevents casual reading
  const key = 'SmartSalesSecureKey2024';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(unescape(encodeURIComponent(result)));
}

function deobfuscate(encoded: string): string {
  const key = 'SmartSalesSecureKey2024';
  const decoded = decodeURIComponent(escape(atob(encoded)));
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(
      decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return result;
}

// ============================================
// Public API
// ============================================

export interface EncryptedPayload {
  __encrypted: true;
  /** IV + ciphertext, base64-encoded */
  data: string;
  /** 'aes-gcm' | 'obfuscated' */
  algo: string;
}

/**
 * Encrypt a JSON-serializable object.
 * Returns an EncryptedPayload that can be stored in IndexedDB.
 */
export async function encryptData<T>(obj: T): Promise<EncryptedPayload> {
  const json = JSON.stringify(obj);

  if (isWebCryptoAvailable()) {
    try {
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
    } catch (err) {
      console.warn('[Encryption] AES-GCM failed, falling back to obfuscation:', err);
    }
  }

  // Fallback: obfuscation
  return {
    __encrypted: true,
    data: obfuscate(json),
    algo: 'obfuscated',
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
      console.error('[Encryption] Decryption failed:', err);
      throw new Error('فشل فك تشفير البيانات المحلية');
    }
  }

  if (payload.algo === 'obfuscated') {
    try {
      const json = deobfuscate(payload.data);
      return JSON.parse(json) as T;
    } catch (err) {
      console.error('[Encryption] Deobfuscation failed:', err);
      throw new Error('فشل فك تشفير البيانات المحلية');
    }
  }

  // Unknown algo — return raw (shouldn't happen)
  return stored as T;
}

/**
 * Check if an object is an encrypted payload.
 */
export function isEncrypted(obj: any): obj is EncryptedPayload {
  return obj && obj.__encrypted === true && typeof obj.data === 'string';
}

/**
 * Clear the device encryption key.
 * Should be called on logout to ensure data is irrecoverable.
 */
export function clearEncryptionKey(): void {
  cachedKey = null;
  localStorage.removeItem(DEVICE_KEY_STORAGE);
}
