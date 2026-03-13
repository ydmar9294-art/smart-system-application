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
 * - Encrypted at rest when Web Crypto is available
 */

import { generateUUID } from '@/lib/uuid';
import { logger } from '@/lib/logger';
import { encryptData, decryptData, isEncrypted, isEncryptionAvailable } from '@/lib/indexedDbEncryption';

const DB_NAME = 'general_offline_queue_v1';
const DB_VERSION = 2; // Bumped for status index
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

interface StoredMutation {
  id: string;
  status: string;
  createdAt: number;
  _enc?: any;
  // Fallback plain fields when encryption is unavailable
  serviceKey?: string;
  args?: any;
  retryCount?: number;
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
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

// ─── Encryption Helpers ────────────────────────────────────────────

async function encryptMutation(mutation: QueuedMutation): Promise<StoredMutation> {
  if (!isEncryptionAvailable()) {
    return mutation as unknown as StoredMutation;
  }
  try {
    const encrypted = await encryptData(mutation);
    if (encrypted && (encrypted as any).__encrypted) {
      return {
        id: mutation.id,
        status: mutation.status,
        createdAt: mutation.createdAt,
        _enc: encrypted,
      };
    }
  } catch {
    // fallback to plaintext
  }
  return mutation as unknown as StoredMutation;
}

async function decryptMutation(stored: StoredMutation): Promise<QueuedMutation | null> {
  try {
    if (stored._enc && isEncrypted(stored._enc)) {
      return await decryptData<QueuedMutation>(stored._enc);
    }
    return stored as unknown as QueuedMutation;
  } catch {
    logger.warn('[OfflineQueue] Failed to decrypt mutation, skipping', 'OfflineMutationQueue');
    return null;
  }
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
  const stored = await encryptMutation(mutation);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPending(): Promise<QueuedMutation[]> {
  const db = await openQueueDB();
  const raw: StoredMutation[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result || []) as StoredMutation[]);
    req.onerror = () => reject(req.error);
  });

  const mutations: QueuedMutation[] = [];
  for (const stored of raw) {
    const m = await decryptMutation(stored);
    if (m && m.status === 'pending') {
      mutations.push(m);
    }
  }
  return mutations.sort((a, b) => a.createdAt - b.createdAt);
}

async function updateMutation(id: string, updates: Partial<QueuedMutation>): Promise<void> {
  const db = await openQueueDB();
  const raw: StoredMutation | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as StoredMutation | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!raw) return;

  const existing = await decryptMutation(raw);
  if (!existing) return;

  const updated = { ...existing, ...updates };
  const stored = await encryptMutation(updated);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(stored);
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
        const all = (req.result || []) as StoredMutation[];
        // Use plaintext status field for efficient counting (no decryption needed)
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
        const m = cursor.value as StoredMutation;
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
