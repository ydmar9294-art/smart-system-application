/**
 * Generic Offline Cache Service
 * 
 * Provides persistent IndexedDB caching for all dashboard data.
 * Used by React Query hooks to serve data offline.
 * 
 * Performance optimizations:
 * - Non-sensitive data stored unencrypted (skips AES-GCM overhead)
 * - IDB index on updatedAt for fast cleanup (v2+)
 * - Sensitive data (financial) always encrypted at rest
 */

import { encryptData, decryptData, isEncrypted } from './indexedDbEncryption';
import { logger } from './logger';
import { PERF_FLAGS, isNonSensitiveKey } from '@/config/performance';

const DB_NAME = 'app_offline_cache_v1';
const DB_VERSION = PERF_FLAGS.IDB_INDEX ? 2 : 1;
const STORE_NAME = 'query_cache';

// Default TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  key: string;
  data: any; // encrypted payload or plain JSON
  updatedAt: number;
  ttlMs: number;
}

// ============================================
// IndexedDB Connection
// ============================================

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

function openCacheDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    try {
      dbInstance.transaction(STORE_NAME, 'readonly');
      return Promise.resolve(dbInstance);
    } catch {
      dbInstance = null;
      dbOpenPromise = null;
    }
  }

  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      } else if (event.oldVersion < 2) {
        // Upgrading from v1 → v2: add index on existing store
        try {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(STORE_NAME);
          if (!store.indexNames.contains('by_updatedAt')) {
            store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
          }
        } catch {
          // Index creation failed — non-fatal, cleanup falls back to cursor
        }
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => { dbInstance = null; dbOpenPromise = null; };
      dbInstance.onerror = () => { dbInstance = null; dbOpenPromise = null; };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbOpenPromise = null;
      reject(request.error);
    };
  });

  return dbOpenPromise;
}

// ============================================
// Cache Key Serialization
// ============================================

function serializeKey(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}

// ============================================
// Public API
// ============================================

/**
 * Read cached data for a query key.
 * Returns null if not found or expired.
 */
export async function getCachedQueryData<T>(
  queryKey: readonly unknown[],
  options?: { encrypt?: boolean }
): Promise<T | null> {
  try {
    const db = await openCacheDB();
    const key = serializeKey(queryKey);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);

      req.onsuccess = async () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) { resolve(null); return; }

        // Check TTL
        if (Date.now() - entry.updatedAt > entry.ttlMs) {
          deleteCachedQueryData(queryKey).catch(() => {});
          resolve(null);
          return;
        }

        try {
          // Determine if data needs decryption
          if (isEncrypted(entry.data)) {
            const decrypted = await decryptData<T>(entry.data);
            resolve(decrypted);
          } else {
            resolve(entry.data as T);
          }
        } catch (err) {
          logger.warn('[OfflineCache] Decryption failed, clearing entry', err);
          deleteCachedQueryData(queryKey).catch(() => {});
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist query data to IndexedDB.
 * Sensitive data is encrypted; non-sensitive data stored as plain JSON.
 */
export async function setCachedQueryData<T>(
  queryKey: readonly unknown[],
  data: T,
  ttlMs: number = DEFAULT_TTL_MS,
  options?: { encrypt?: boolean }
): Promise<void> {
  try {
    const db = await openCacheDB();
    const key = serializeKey(queryKey);

    // Determine encryption: explicit option > auto-detect from key
    const shouldEncrypt = options?.encrypt ?? !isNonSensitiveKey(queryKey);

    const storedData = shouldEncrypt ? await encryptData(data) : data;

    const entry: CacheEntry = {
      key,
      data: storedData,
      updatedAt: Date.now(),
      ttlMs,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[OfflineCache] Failed to cache data', err);
  }
}

/**
 * Delete a specific cache entry.
 */
export async function deleteCachedQueryData(queryKey: readonly unknown[]): Promise<void> {
  try {
    const db = await openCacheDB();
    const key = serializeKey(queryKey);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silently fail
  }
}

/**
 * Clear all cached data (on logout).
 */
export async function clearAllCachedData(): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silently fail
  }
}

/**
 * Cleanup expired entries.
 * Uses IDB index (v2+) for faster range scan when available.
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const db = await openCacheDB();
    const now = Date.now();
    let cleaned = 0;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(cleaned); return; }

        const entry = cursor.value as CacheEntry;
        if (now - entry.updatedAt > entry.ttlMs) {
          cursor.delete();
          cleaned++;
        }
        cursor.continue();
      };

      cursorReq.onerror = () => resolve(cleaned);
    });
  } catch {
    return 0;
  }
}
