/**
 * Offline IndexedDB Connection & Generic Store Helpers
 * 
 * Shared database connection, schema setup, low-level CRUD,
 * encryption wrappers, and write mutex.
 */

import { encryptData, decryptData, isEncrypted } from '@/lib/indexedDbEncryption';
import { logger } from '@/lib/logger';

// ============================================
// Database Constants
// ============================================

export const DB_NAME = 'distributor_offline_v4';
export const DB_VERSION = 5; // Bumped for new index on id_maps.type

export const STORES = {
  ACTIONS: 'offline_actions',
  INVENTORY_CACHE: 'inventory_cache',
  CUSTOMERS_CACHE: 'customers_cache',
  SALES_CACHE: 'sales_cache',
  INVOICES_CACHE: 'invoices_cache',
  ORG_INFO_CACHE: 'org_info_cache',
  ID_MAPS: 'id_maps',
} as const;

// ============================================
// IndexedDB Connection (resilient)
// ============================================

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    try {
      dbInstance.transaction(STORES.ACTIONS, 'readonly');
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
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORES.ACTIONS)) {
        const store = db.createObjectStore(STORES.ACTIONS, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.INVENTORY_CACHE)) {
        db.createObjectStore(STORES.INVENTORY_CACHE, { keyPath: 'product_id' });
      }

      if (!db.objectStoreNames.contains(STORES.CUSTOMERS_CACHE)) {
        db.createObjectStore(STORES.CUSTOMERS_CACHE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SALES_CACHE)) {
        db.createObjectStore(STORES.SALES_CACHE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.INVOICES_CACHE)) {
        db.createObjectStore(STORES.INVOICES_CACHE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.ORG_INFO_CACHE)) {
        db.createObjectStore(STORES.ORG_INFO_CACHE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.ID_MAPS)) {
        const idMapsStore = db.createObjectStore(STORES.ID_MAPS, { keyPath: 'localId' });
        idMapsStore.createIndex('type', 'type', { unique: false });
      }

      // v4 → v5 migration: Add 'type' index to existing id_maps store
      if (oldVersion < 5 && db.objectStoreNames.contains(STORES.ID_MAPS)) {
        try {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx) {
            const store = tx.objectStore(STORES.ID_MAPS);
            if (!store.indexNames.contains('type')) {
              store.createIndex('type', 'type', { unique: false });
            }
          }
        } catch {
          // Non-critical: index creation failed, full scan still works
          logger.warn('[OfflineDb] Failed to create type index on id_maps during migration', 'DistributorOffline');
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
      // If IDB was deleted/corrupted, attempt to recreate
      if (request.error?.name === 'VersionError' || request.error?.name === 'InvalidStateError') {
        logger.error('[OfflineDb] Database corrupted, attempting recreation', 'DistributorOffline');
        handleDatabaseRecreation().then(resolve).catch(reject);
      } else {
        reject(request.error);
      }
    };
  });

  return dbOpenPromise;
}

/** Attempt to delete and recreate the database when corruption is detected. */
async function handleDatabaseRecreation(): Promise<IDBDatabase> {
  dbInstance = null;
  dbOpenPromise = null;

  await new Promise<void>((resolve) => {
    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
    deleteReq.onsuccess = () => resolve();
    deleteReq.onerror = () => resolve();
    deleteReq.onblocked = () => resolve();
  });

  logger.warn('[OfflineDb] Database recreated after corruption', 'DistributorOffline');
  return openDB();
}

/** Reset the cached DB connection (used during logout/clear). */
export function resetDbConnection(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbOpenPromise = null;
}

// ============================================
// Write Mutex
// ============================================

const writeLocks = new Map<string, Promise<void>>();

export async function withWriteLock<T>(storeName: string, fn: () => Promise<T>): Promise<T> {
  const existing = writeLocks.get(storeName);
  if (existing) {
    await existing.catch(() => {});
  }

  let resolve: () => void;
  const lock = new Promise<void>(r => { resolve = r; });
  writeLocks.set(storeName, lock);

  try {
    return await fn();
  } finally {
    resolve!();
    if (writeLocks.get(storeName) === lock) {
      writeLocks.delete(storeName);
    }
  }
}

// ============================================
// Generic Store Helpers
// ============================================

export async function putItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getItem<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// Atomic Replace
// ============================================

export async function atomicReplaceStore(storeName: string, items: Array<{ key: string; value: any }>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const { value } of items) {
      store.put(value);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Encrypted Store Helpers
// ============================================

export async function prepareEncryptedRecord<T extends Record<string, any>>(
  item: T,
  keyField: string = 'id'
): Promise<Record<string, any>> {
  const keyValue = item[keyField];
  const encrypted = await encryptData(item);
  if (encrypted && (encrypted as any).__encrypted) {
    return { [keyField]: keyValue, _enc: encrypted };
  }
  return { ...item, [keyField]: keyValue };
}

export async function putEncryptedItem<T extends Record<string, any>>(
  storeName: string,
  item: T,
  keyField: string = 'id'
): Promise<void> {
  const keyValue = item[keyField];
  const encrypted = await encryptData(item);
  if (encrypted && (encrypted as any).__encrypted) {
    await putItem(storeName, { [keyField]: keyValue, _enc: encrypted });
  } else {
    await putItem(storeName, { ...item, [keyField]: keyValue });
  }
}

export async function getAllEncryptedItems<T>(storeName: string): Promise<T[]> {
  const raw = await getAllItems<any>(storeName);
  const results: T[] = [];
  for (const item of raw) {
    try {
      if (item._enc && isEncrypted(item._enc)) {
        results.push(await decryptData<T>(item._enc));
      } else {
        results.push(item as T);
      }
    } catch (err) {
      logger.warn(`[Encryption] Failed to decrypt item in ${storeName}, skipping`, 'DistributorOffline');
    }
  }
  return results;
}

export async function getEncryptedItem<T>(storeName: string, key: string): Promise<T | null> {
  const raw = await getItem<any>(storeName, key);
  if (!raw) return null;
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      return await decryptData<T>(raw._enc);
    }
    return raw as T;
  } catch (err) {
    logger.warn(`[Encryption] Failed to decrypt item ${key} in ${storeName}`, 'DistributorOffline');
    return null;
  }
}
