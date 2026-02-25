/**
 * Distributor Offline Service
 * 
 * Provides offline-first operations for the distributor:
 * - Local IndexedDB cache for inventory, customers, sales
 * - Offline action queue with auto-sync
 * - Optimistic UI updates
 * 
 * Architecture:
 * - All writes go to IndexedDB first (instant)
 * - Background sync pushes to Supabase when online
 * - UI always reads from local cache
 */

import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================
// Database Setup
// ============================================

const DB_NAME = 'distributor_offline_v2';
const DB_VERSION = 2;

const STORES = {
  ACTIONS: 'offline_actions',
  INVENTORY_CACHE: 'inventory_cache',
  CUSTOMERS_CACHE: 'customers_cache',
  SALES_CACHE: 'sales_cache',
} as const;

export type OfflineActionType = 
  | 'CREATE_SALE'
  | 'ADD_COLLECTION'
  | 'CREATE_RETURN'
  | 'TRANSFER_TO_WAREHOUSE'
  | 'ADD_CUSTOMER';

export type OfflineActionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  status: OfflineActionStatus;
  retryCount: number;
  createdAt: number;
  syncedAt?: number;
  error?: string;
  idempotencyKey: string;
}

// ============================================
// IndexedDB Connection
// ============================================

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
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
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Generic Store Helpers
// ============================================

async function putItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Action Queue
// ============================================

export async function enqueueAction(
  type: OfflineActionType,
  payload: any
): Promise<OfflineAction> {
  const action: OfflineAction = {
    id: generateUUID(),
    type,
    payload,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
    idempotencyKey: generateUUID(),
  };
  
  await putItem(STORES.ACTIONS, action);
  logger.info(`[OfflineQueue] Enqueued ${type}`, 'DistributorOffline');
  return action;
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const all = await getAllItems<OfflineAction>(STORES.ACTIONS);
  return all
    .filter(a => a.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAllActions(): Promise<OfflineAction[]> {
  const all = await getAllItems<OfflineAction>(STORES.ACTIONS);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateAction(id: string, updates: Partial<OfflineAction>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.ACTIONS);
    const getReq = store.get(id);
    
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedActions(): Promise<void> {
  const all = await getAllItems<OfflineAction>(STORES.ACTIONS);
  for (const action of all) {
    if (action.status === 'synced') {
      await deleteItem(STORES.ACTIONS, action.id);
    }
  }
}

export async function getActionStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}> {
  const all = await getAllItems<OfflineAction>(STORES.ACTIONS);
  return {
    pending: all.filter(a => a.status === 'pending').length,
    syncing: all.filter(a => a.status === 'syncing').length,
    synced: all.filter(a => a.status === 'synced').length,
    failed: all.filter(a => a.status === 'failed').length,
    total: all.length,
  };
}

// ============================================
// Inventory Cache
// ============================================

export interface CachedInventoryItem {
  product_id: string;
  product_name: string;
  quantity: number;
  base_price: number;
  consumer_price: number;
  unit: string;
  updated_at: number;
}

export async function cacheInventory(items: CachedInventoryItem[]): Promise<void> {
  await clearStore(STORES.INVENTORY_CACHE);
  for (const item of items) {
    await putItem(STORES.INVENTORY_CACHE, { ...item, updated_at: Date.now() });
  }
}

export async function getCachedInventory(): Promise<CachedInventoryItem[]> {
  return getAllItems<CachedInventoryItem>(STORES.INVENTORY_CACHE);
}

export async function updateCachedInventoryQuantity(
  productId: string,
  quantityDelta: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.INVENTORY_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.INVENTORY_CACHE);
    const getReq = store.get(productId);
    
    getReq.onsuccess = () => {
      if (getReq.result) {
        const item = getReq.result;
        item.quantity = Math.max(0, item.quantity + quantityDelta);
        item.updated_at = Date.now();
        store.put(item);
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Sync Engine — Direct RPC Calls
// ============================================

const MAX_RETRIES = 5;
let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/** Listeners for sync events */
type SyncListener = (event: { type: 'start' | 'progress' | 'complete' | 'error'; synced?: number; failed?: number; total?: number; message?: string }) => void;
const syncListeners: Set<SyncListener> = new Set();

export function onSyncEvent(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncListeners(event: Parameters<SyncListener>[0]) {
  syncListeners.forEach(l => l(event));
}

async function executeAction(action: OfflineAction): Promise<boolean> {
  try {
    switch (action.type) {
      case 'CREATE_SALE': {
        const { error } = await supabase.rpc('create_distributor_sale_rpc', {
          p_customer_id: action.payload.customerId,
          p_items: action.payload.items,
          p_payment_type: action.payload.paymentType || 'CASH',
        });
        if (error) throw error;
        return true;
      }

      case 'ADD_COLLECTION': {
        const { error } = await supabase.rpc('add_collection_rpc', {
          p_sale_id: action.payload.saleId,
          p_amount: action.payload.amount,
          p_notes: action.payload.notes || null,
        });
        if (error) throw error;
        return true;
      }

      case 'CREATE_RETURN': {
        const { error } = await supabase.rpc('create_distributor_return_rpc', {
          p_sale_id: action.payload.saleId,
          p_items: action.payload.items,
          p_reason: action.payload.reason || null,
        });
        if (error) throw error;
        return true;
      }

      case 'TRANSFER_TO_WAREHOUSE': {
        const { error } = await supabase.rpc('transfer_to_main_warehouse_rpc', {
          p_items: action.payload.items,
        });
        if (error) throw error;
        return true;
      }

      case 'ADD_CUSTOMER': {
        const { error } = await supabase.from('customers').insert({
          name: action.payload.name,
          phone: action.payload.phone,
          location: action.payload.location,
          organization_id: action.payload.organizationId,
          created_by: action.payload.createdBy,
        });
        if (error) throw error;
        return true;
      }

      default:
        logger.warn(`[Sync] Unknown action type: ${action.type}`, 'DistributorOffline');
        return false;
    }
  } catch (err: any) {
    logger.error(`[Sync] Action ${action.id} (${action.type}) failed: ${err.message}`, 'DistributorOffline');
    return false;
  }
}

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingActions();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    notifySyncListeners({ type: 'start', total: pending.length });
    logger.info(`[Sync] Processing ${pending.length} pending actions`, 'DistributorOffline');

    for (const action of pending) {
      await updateAction(action.id, { status: 'syncing' });
      
      const success = await executeAction(action);

      if (success) {
        await updateAction(action.id, { status: 'synced', syncedAt: Date.now() });
        synced++;
      } else {
        const newRetry = action.retryCount + 1;
        if (newRetry >= MAX_RETRIES) {
          await updateAction(action.id, { status: 'failed', retryCount: newRetry, error: 'تجاوز الحد الأقصى للمحاولات' });
          failed++;
        } else {
          await updateAction(action.id, { status: 'pending', retryCount: newRetry });
        }
      }

      notifySyncListeners({ type: 'progress', synced, failed, total: pending.length });
    }

    // Cleanup old synced actions (keep last 24h)
    const allActions = await getAllActions();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const a of allActions) {
      if (a.status === 'synced' && a.createdAt < cutoff) {
        await deleteItem(STORES.ACTIONS, a.id);
      }
    }

    notifySyncListeners({ type: 'complete', synced, failed, total: pending.length });
    logger.info(`[Sync] Done: ${synced} synced, ${failed} failed`, 'DistributorOffline');
  } catch (err) {
    notifySyncListeners({ type: 'error', message: String(err) });
    logger.error('[Sync] Process error', 'DistributorOffline', { error: String(err) });
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

export function startDistributorSync(): void {
  if (syncIntervalId) return;
  
  // Initial sync after short delay
  setTimeout(syncAllPending, 2000);
  
  // Periodic sync every 90s
  syncIntervalId = setInterval(syncAllPending, 90_000);
  
  // Sync on reconnect
  window.addEventListener('online', handleOnline);
}

export function stopDistributorSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  window.removeEventListener('online', handleOnline);
}

function handleOnline(): void {
  logger.info('[Sync] Connection restored, syncing...', 'DistributorOffline');
  setTimeout(syncAllPending, 1000);
}

export function getIsSyncing(): boolean {
  return isSyncing;
}
