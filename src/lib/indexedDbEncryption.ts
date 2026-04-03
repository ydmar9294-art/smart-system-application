/**
 * IndexedDB Encryption Layer
 * 
 * Encrypts sensitive data before storing in IndexedDB using AES-GCM.
 * Key is derived from a random device key stored via secure key store.
 * 
 * Performance optimization: encryption/decryption is offloaded to a Web Worker
 * when available, keeping the main thread free. Falls back to main-thread
 * crypto if the Worker fails to initialize.
 */

import { logger } from '@/lib/logger';
import { PERF_FLAGS } from '@/config/performance';

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
 */
async function getDeviceKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const { getSecureKey, storeSecureKey } = await import('@/services/secureKeyStore');
  
  const storedKeyB64 = await getSecureKey();

  if (storedKeyB64) {
    const rawKey = base64ToBuffer(storedKeyB64);
    cachedKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
    );
  } else {
    cachedKey = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 }, true, ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', cachedKey);
    await storeSecureKey(bufferToBase64(exported));
  }

  return cachedKey;
}

/**
 * Get the base64 key string for Worker communication.
 */
async function getKeyB64(): Promise<string> {
  const { getSecureKey, storeSecureKey } = await import('@/services/secureKeyStore');
  let keyB64 = await getSecureKey();
  if (!keyB64) {
    // Generate and store
    const newKey = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 }, true, ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', newKey);
    keyB64 = bufferToBase64(exported);
    await storeSecureKey(keyB64);
    // Also cache the CryptoKey
    cachedKey = newKey;
  }
  return keyB64;
}

// ============================================
// Web Worker for off-main-thread crypto
// ============================================

let cryptoWorker: Worker | null = null;
let workerFailed = false;
let workerMsgId = 0;
const pendingWorkerCalls = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

function initCryptoWorker(): Worker | null {
  if (workerFailed) return null;
  if (cryptoWorker) return cryptoWorker;

  try {
    cryptoWorker = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url),
      { type: 'module' }
    );
    cryptoWorker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data;
      const pending = pendingWorkerCalls.get(id);
      if (pending) {
        pendingWorkerCalls.delete(id);
        if (error) pending.reject(new Error(error));
        else pending.resolve(result);
      }
    };
    cryptoWorker.onerror = () => {
      workerFailed = true;
      cryptoWorker = null;
      // Reject all pending
      for (const [, p] of pendingWorkerCalls) {
        p.reject(new Error('Worker crashed'));
      }
      pendingWorkerCalls.clear();
    };
    return cryptoWorker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function callWorker(op: string, data: Record<string, any>): Promise<any> {
  const worker = initCryptoWorker();
  if (!worker) return Promise.reject(new Error('No worker'));

  const id = ++workerMsgId;
  return new Promise((resolve, reject) => {
    // Timeout after 10s
    const timer = setTimeout(() => {
      pendingWorkerCalls.delete(id);
      reject(new Error('Worker timeout'));
    }, 10_000);

    pendingWorkerCalls.set(id, {
      resolve: (v: any) => { clearTimeout(timer); resolve(v); },
      reject: (e: any) => { clearTimeout(timer); reject(e); },
    });

    worker.postMessage({ id, op, ...data });
  });
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

export async function verifyHMAC(data: string, expectedSignature: string): Promise<boolean> {
  try {
    const computed = await computeHMAC(data);
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
  data: string;
  algo: 'aes-gcm';
}

export function isRawPassthrough(obj: any): boolean {
  return obj && typeof obj === 'object' && !obj.__encrypted;
}

export function isEncryptionAvailable(): boolean {
  return isWebCryptoAvailable();
}

/**
 * Encrypt a JSON-serializable object.
 * Uses Web Worker when PERF_FLAGS.USE_CRYPTO_WORKER is true.
 * Falls back to main-thread crypto if Worker fails.
 */
export async function encryptData<T>(obj: T): Promise<EncryptedPayload | T> {
  if (!isWebCryptoAvailable()) {
    logger.warn('Web Crypto API unavailable — storing data without encryption', 'Encryption');
    return obj;
  }

  // Try Worker path first
  if (PERF_FLAGS.USE_CRYPTO_WORKER && !workerFailed) {
    try {
      const keyB64 = await getKeyB64();
      const json = JSON.stringify(obj);
      const result = await callWorker('encrypt', { json, keyB64 });
      return result as EncryptedPayload;
    } catch {
      // Fall through to main-thread
      logger.warn('Crypto Worker failed, falling back to main thread', 'Encryption');
    }
  }

  // Main-thread fallback
  const json = JSON.stringify(obj);
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(json);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );

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
 * Uses Web Worker when PERF_FLAGS.USE_CRYPTO_WORKER is true.
 */
export async function decryptData<T>(stored: any): Promise<T> {
  if (!stored || !stored.__encrypted) {
    return stored as T;
  }

  const payload = stored as EncryptedPayload;

  if (payload.algo === 'aes-gcm' && isWebCryptoAvailable()) {
    // Try Worker path first
    if (PERF_FLAGS.USE_CRYPTO_WORKER && !workerFailed) {
      try {
        const keyB64 = await getKeyB64();
        const json = await callWorker('decrypt', { payload: { data: payload.data }, keyB64 });
        return JSON.parse(json) as T;
      } catch {
        // Fall through to main-thread
        logger.warn('Crypto Worker decrypt failed, falling back to main thread', 'Encryption');
      }
    }

    // Main-thread fallback
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

  if ((payload as any).algo === 'obfuscated') {
    logger.warn('Found legacy obfuscated data — returning raw for migration', 'Encryption');
    return stored as T;
  }

  return stored as T;
}

export function isEncrypted(obj: any): obj is EncryptedPayload {
  return obj && obj.__encrypted === true && typeof obj.data === 'string';
}

export async function clearEncryptionKey(): Promise<void> {
  cachedKey = null;
  // Clear worker key cache too
  if (cryptoWorker && !workerFailed) {
    try { await callWorker('clearKey', {}); } catch {}
  }
  try {
    const { deleteSecureKey } = await import('@/services/secureKeyStore');
    await deleteSecureKey();
  } catch {}
}

export async function checkAndRotateKeyIfNeeded(): Promise<boolean> {
  if (!isWebCryptoAvailable()) return false;

  try {
    const { isKeyRotationNeeded, rotateSecureKey } = await import('@/services/secureKeyStore');
    const needsRotation = await isKeyRotationNeeded();
    if (!needsRotation) return false;

    const oldKey = cachedKey;
    if (!oldKey) {
      const { newKeyB64 } = await rotateSecureKey();
      cachedKey = null;
      const rawKey = base64ToBuffer(newKeyB64);
      cachedKey = await crypto.subtle.importKey(
        'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
      );
      // Clear worker cache so it picks up new key
      if (cryptoWorker && !workerFailed) {
        try { await callWorker('clearKey', {}); } catch {}
      }
      logger.info('Encryption key rotated (no data to re-encrypt)', 'Encryption');
      return true;
    }

    const { newKeyB64 } = await rotateSecureKey();
    const rawNewKey = base64ToBuffer(newKeyB64);
    const newCryptoKey = await crypto.subtle.importKey(
      'raw', rawNewKey, { name: ALGO }, false, ['encrypt', 'decrypt']
    );

    await reEncryptDatabase('app_offline_cache_v1', 'query_cache', 'key', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'inventory_cache', 'product_id', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'customers_cache', 'id', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'sales_cache', 'id', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'invoices_cache', 'id', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'org_info_cache', 'key', oldKey, newCryptoKey);
    await reEncryptDatabase('distributor_offline_v4', 'offline_actions', 'id', oldKey, newCryptoKey);

    cachedKey = newCryptoKey;
    // Clear worker cache
    if (cryptoWorker && !workerFailed) {
      try { await callWorker('clearKey', {}); } catch {}
    }
    logger.info('Encryption key rotated and all data re-encrypted successfully', 'Encryption');
    return true;
  } catch (err) {
    logger.error('Key rotation failed — keeping old key to prevent data loss', 'Encryption');
    return false;
  }
}

async function reEncryptDatabase(
  dbName: string,
  storeName: string,
  _keyField: string,
  oldKey: CryptoKey,
  newKey: CryptoKey
): Promise<void> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return;
    }

    const records = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (records.length === 0) {
      db.close();
      return;
    }

    const reEncrypted: any[] = [];
    for (const record of records) {
      if (record._enc && record._enc.__encrypted) {
        try {
          const combined = new Uint8Array(base64ToBuffer(record._enc.data));
          const iv = combined.slice(0, IV_LENGTH);
          const ciphertext = combined.slice(IV_LENGTH);
          const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, oldKey, ciphertext);

          const newIv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
          const newCiphertext = await crypto.subtle.encrypt({ name: ALGO, iv: newIv }, newKey, decrypted);
          const newCombined = new Uint8Array(IV_LENGTH + newCiphertext.byteLength);
          newCombined.set(newIv, 0);
          newCombined.set(new Uint8Array(newCiphertext), IV_LENGTH);

          reEncrypted.push({
            ...record,
            _enc: { __encrypted: true, data: bufferToBase64(newCombined.buffer), algo: 'aes-gcm' },
          });
        } catch {
          logger.warn(`[KeyRotation] Skipping unreadable record in ${storeName}`, 'Encryption');
          reEncrypted.push(record);
        }
      } else {
        reEncrypted.push(record);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const rec of reEncrypted) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    logger.info(`[KeyRotation] Re-encrypted ${reEncrypted.length} records in ${dbName}/${storeName}`, 'Encryption');
  } catch (err) {
    logger.warn(`[KeyRotation] Failed to re-encrypt ${dbName}/${storeName}: ${err}`, 'Encryption');
  }
}
