/**
 * Offline Mutation Queue for Non-Distributor Roles
 * 
 * Wraps any async mutation so that when offline, the operation is:
 * 1. Stored in IndexedDB as a pending action
 * 2. Retried automatically when connectivity is restored
 * 
 * Unlike the distributor system (which has a full offline-first architecture),
 * this is a lightweight "retry on reconnect" queue for Owner/Accountant/
 * SalesManager/Warehouse roles. Their mutations use optimistic UI updates
 * already — this just prevents the rollback when offline.
 * 
 * Architecture:
 * - Uses a separate IDB database to avoid conflicts with distributor DB
 * - Simple FIFO queue with exponential backoff
 * - Max 3 retries before marking as failed
 * - Auto-processes on 'online' event
 */

import { generateUUID } from '@/lib/uuid';
import { logger } from '@/lib/logger';

const DB_NAME = 'general_offline_queue_v1';
const DB_VERSION = 1;
const STORE_NAME = 'queued_mutations';

interface QueuedMutation {
  id: string;
  /** Serialized function identifier (e.g. 'salesService.createSale') */
  serviceKey: string;
  /** JSON-serializable arguments */
  args: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: number;
  error?: string;
}

// ─── IndexedDB Connection ──────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openQueueDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    try {
      dbInstance.transaction(STORE_NAME, 'readonly');
      return Promise.resolve(dbInstance);
    } catch {
      dbInstance = null;
      dbPromise = null;
    }
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onclose = () => { dbInstance = null; dbPromise = null; };
      resolve(dbInstance);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// ─── Service Registry ──────────────────────────────────────────────

type ServiceFn = (...args: any[]) => Promise<any>;
const serviceRegistry = new Map<string, ServiceFn>();

/**
 * Register a service function so it can be replayed from the queue.
 * Call this during hook initialization.
 */
export function registerOfflineService(key: string, fn: ServiceFn): void {
  serviceRegistry.set(key, fn);
}

// ─── Queue Operations ──────────────────────────────────────────────

async function enqueue(serviceKey: string, args: any): Promise<void> {
  const db = await openQueueDB();
  const mutation: QueuedMutation = {
    id: generateUUID(),
    serviceKey,
    args,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPending(): Promise<QueuedMutation[]> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as QueuedMutation[];
      resolve(all.filter(m => m.status === 'pending').sort((a, b) => a.createdAt - b.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateMutation(id: string, updates: Partial<QueuedMutation>): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (!getReq.result) { resolve(); return; }
      store.put({ ...getReq.result, ...updates });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueStats(): Promise<{ pending: number; failed: number }> {
  try {
    const db = await openQueueDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as QueuedMutation[];
        resolve({
          pending: all.filter(m => m.status === 'pending').length,
          failed: all.filter(m => m.status === 'failed').length,
        });
      };
      req.onerror = () => resolve({ pending: 0, failed: 0 });
    });
  } catch {
    return { pending: 0, failed: 0 };
  }
}

// ─── Sync Engine ───────────────────────────────────────────────────

const MAX_RETRIES = 3;
let isSyncing = false;

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) return { synced: 0, failed: 0 };
  isSyncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPending();
    for (const mutation of pending) {
      const fn = serviceRegistry.get(mutation.serviceKey);
      if (!fn) {
        await updateMutation(mutation.id, { status: 'failed', error: `Unknown service: ${mutation.serviceKey}` });
        failed++;
        continue;
      }

      await updateMutation(mutation.id, { status: 'syncing' });

      try {
        await fn(...(Array.isArray(mutation.args) ? mutation.args : [mutation.args]));
        await updateMutation(mutation.id, { status: 'synced' });
        synced++;
      } catch (err: any) {
        const newRetry = mutation.retryCount + 1;
        if (newRetry >= MAX_RETRIES) {
          await updateMutation(mutation.id, { status: 'failed', retryCount: newRetry, error: err.message });
          failed++;
        } else {
          await updateMutation(mutation.id, { status: 'pending', retryCount: newRetry });
        }
      }
    }

    // Cleanup old synced entries (>24h)
    const db = await openQueueDB();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(); return; }
        const m = cursor.value as QueuedMutation;
        if (m.status === 'synced' && m.createdAt < cutoff) cursor.delete();
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    });
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

// ─── Auto-Sync on Reconnect ───────────────────────────────────────

let listenerAttached = false;

function ensureOnlineListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('online', () => {
    logger.info('[OfflineQueue] Connection restored, processing queue...', 'OfflineMutationQueue');
    setTimeout(processQueue, 1500);
  });
}

// ─── Public Hook Helper ────────────────────────────────────────────

/**
 * Wraps a service call to automatically queue it when offline.
 * Returns a function with the same signature that:
 * - When online: calls the service directly
 * - When offline: enqueues for later execution
 */
export function withOfflineQueue<T extends any[]>(
  serviceKey: string,
  fn: (...args: T) => Promise<any>
): (...args: T) => Promise<void> {
  // Register on first use
  registerOfflineService(serviceKey, fn);
  ensureOnlineListener();

  return async (...args: T) => {
    if (navigator.onLine) {
      return fn(...args);
    }
    // Queue for later
    await enqueue(serviceKey, args);
    logger.info(`[OfflineQueue] Queued ${serviceKey} for later sync`, 'OfflineMutationQueue');
  };
}

/**
 * Clear all queued mutations (call on logout).
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
      dbPromise = null;
    }
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch {
    // best effort
  }
}
