/**
 * Offline Queue Manager
 * Uses IndexedDB for persistent offline operation queue.
 * Supports auto-sync on reconnect with idempotency.
 */

import { generateUUID } from '@/lib/uuid';

const DB_NAME = 'smart_system_offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';
const MAX_RETRIES = 5;

export interface OfflineOperation {
  id: string;
  operation_type: string;
  payload: any;
  endpoint: string;
  method: string;
  status: 'pending' | 'synced' | 'failed';
  retry_count: number;
  created_at: number;
  idempotency_key: string;
}

// ============================================
// IndexedDB Helpers
// ============================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  return generateUUID();
}

// ============================================
// Queue Operations
// ============================================

export async function enqueueOperation(
  operationType: string,
  payload: any,
  endpoint: string,
  method: string = 'POST'
): Promise<string> {
  const db = await openDB();
  const id = generateId();
  const idempotencyKey = generateId();

  const operation: OfflineOperation = {
    id,
    operation_type: operationType,
    payload,
    endpoint,
    method,
    status: 'pending',
    retry_count: 0,
    created_at: Date.now(),
    idempotency_key: idempotencyKey,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(operation);
    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getPendingOperations(): Promise<OfflineOperation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('status');
    const request = index.getAll('pending');
    request.onsuccess = () => {
      db.close();
      const sorted = (request.result as OfflineOperation[]).sort(
        (a, b) => a.created_at - b.created_at
      );
      resolve(sorted);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function updateOperationStatus(
  id: string,
  status: 'pending' | 'synced' | 'failed',
  retryCount?: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const op = getReq.result;
      if (op) {
        op.status = status;
        if (retryCount !== undefined) op.retry_count = retryCount;
        store.put(op);
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearSyncedOperations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.openCursor('synced');

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getQueueStats(): Promise<{
  pending: number;
  synced: number;
  failed: number;
}> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = store.getAll();

    all.onsuccess = () => {
      db.close();
      const ops = all.result as OfflineOperation[];
      resolve({
        pending: ops.filter((o) => o.status === 'pending').length,
        synced: ops.filter((o) => o.status === 'synced').length,
        failed: ops.filter((o) => o.status === 'failed').length,
      });
    };
    all.onerror = () => {
      db.close();
      reject(all.error);
    };
  });
}

export { MAX_RETRIES };
