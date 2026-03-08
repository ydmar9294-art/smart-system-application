/**
 * Generic Offline Cache Service
 * 
 * Provides persistent IndexedDB caching for all dashboard data.
 * Used by React Query hooks to serve data offline.
 * Data is encrypted at rest using AES-256-GCM.
 * 
 * Architecture:
 * - Separate IDB from distributor's database to avoid conflicts
 * - Each query key maps to a store entry
 * - TTL-based expiration (configurable per cache)
 * - Encrypted storage for all sensitive data
 */

import { encryptData, decryptData, isEncrypted } from './indexedDbEncryption';
import { logger } from './logger';

const DB_NAME = 'app_offline_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'query_cache';

// Default TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  key: string;
  data: any; // encrypted payload
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

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
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
export async function getCachedQueryData<T>(queryKey: readonly unknown[]): Promise<T | null> {
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
          // Expired — clean up in background, don't block read
          deleteCachedQueryData(queryKey).catch(() => {});
          resolve(null);
          return;
        }

        try {
          // Decrypt data
          const decrypted = isEncrypted(entry.data)
            ? await decryptData<T>(entry.data)
            : entry.data as T;
          resolve(decrypted);
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
 * Persist query data to IndexedDB (encrypted).
 */
export async function setCachedQueryData<T>(
  queryKey: readonly unknown[],
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  try {
    const db = await openCacheDB();
    const key = serializeKey(queryKey);
    const encrypted = await encryptData(data);

    const entry: CacheEntry = {
      key,
      data: encrypted,
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
 * Cleanup expired entries (call periodically).
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
