/**
 * Distributor Offline Service
 * 
 * Provides offline-first operations for the distributor:
 * - Local IndexedDB cache for inventory, customers, sales
 * - Offline action queue with auto-sync
 * - Optimistic UI updates
 * - Customer ID remapping on sync
 * 
 * Architecture:
 * - All writes go to IndexedDB first (instant)
 * - Background sync pushes to Supabase when online
 * - UI always reads from local cache
 * - Customers sync FIRST, then dependent operations remap IDs
 */

import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================
// Database Setup
// ============================================

const DB_NAME = 'distributor_offline_v3';
const DB_VERSION = 3;

const STORES = {
  ACTIONS: 'offline_actions',
  INVENTORY_CACHE: 'inventory_cache',
  CUSTOMERS_CACHE: 'customers_cache',
  SALES_CACHE: 'sales_cache',
  INVOICES_CACHE: 'invoices_cache',
  ORG_INFO_CACHE: 'org_info_cache',
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

      if (!db.objectStoreNames.contains(STORES.INVOICES_CACHE)) {
        db.createObjectStore(STORES.INVOICES_CACHE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.ORG_INFO_CACHE)) {
        db.createObjectStore(STORES.ORG_INFO_CACHE, { keyPath: 'key' });
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
// Customer Cache (offline-first)
// ============================================

export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  balance: number;
  organization_id: string;
  created_by: string | null;
  isLocal?: boolean;       // true = created offline, not yet synced
  syncStatus?: 'pending' | 'synced' | 'failed';
  updated_at: number;
}

export async function cacheCustomers(customers: CachedCustomer[]): Promise<void> {
  // Preserve local (unsynced) customers during server refresh
  const existing = await getAllItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
  const localCustomers = existing.filter(c => c.isLocal && c.syncStatus !== 'synced');
  
  await clearStore(STORES.CUSTOMERS_CACHE);
  
  // Re-add server customers
  for (const c of customers) {
    await putItem(STORES.CUSTOMERS_CACHE, { ...c, updated_at: Date.now() });
  }
  
  // Re-add local unsynced customers (avoid duplicates by ID)
  const serverIds = new Set(customers.map(c => c.id));
  for (const c of localCustomers) {
    if (!serverIds.has(c.id)) {
      await putItem(STORES.CUSTOMERS_CACHE, c);
    }
  }
}

export async function getCachedCustomers(): Promise<CachedCustomer[]> {
  return getAllItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
}

export async function addLocalCustomer(customer: CachedCustomer): Promise<void> {
  await putItem(STORES.CUSTOMERS_CACHE, customer);
}

export async function updateCustomerSyncStatus(
  localId: string,
  status: 'synced' | 'failed',
  serverId?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOMERS_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS_CACHE);
    const getReq = store.get(localId);
    
    getReq.onsuccess = () => {
      if (getReq.result) {
        const c = getReq.result;
        c.syncStatus = status;
        if (status === 'synced' && serverId) {
          // Remove old local entry, add with server ID
          store.delete(localId);
          c.id = serverId;
          c.isLocal = false;
          store.put(c);
        } else {
          store.put(c);
        }
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Map of local temp IDs → server IDs after sync */
const customerIdMap = new Map<string, string>();

export function getCustomerIdMap(): Map<string, string> {
  return customerIdMap;
}

export function resolveCustomerId(id: string): string {
  return customerIdMap.get(id) || id;
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
        // Remap customer ID if it was a local temp ID
        const customerId = resolveCustomerId(action.payload.customerId);
        const { error } = await supabase.rpc('create_distributor_sale_rpc', {
          p_customer_id: customerId,
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
        // Sync customer and capture the server-assigned ID
        const { data, error } = await supabase.from('customers').insert({
          name: action.payload.name,
          phone: action.payload.phone,
          location: action.payload.location,
          organization_id: action.payload.organizationId,
          created_by: action.payload.createdBy,
        }).select('id').single();
        
        if (error) throw error;
        
        // Store the mapping: local temp ID → real server ID
        if (data?.id && action.payload.localId) {
          customerIdMap.set(action.payload.localId, data.id);
          // Update local cache
          await updateCustomerSyncStatus(action.payload.localId, 'synced', data.id);
          logger.info(`[Sync] Customer remapped: ${action.payload.localId} → ${data.id}`, 'DistributorOffline');
        }
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

    // CRITICAL: Sort so ADD_CUSTOMER actions sync FIRST (dependency ordering)
    const sorted = [...pending].sort((a, b) => {
      const priority = (type: OfflineActionType) => type === 'ADD_CUSTOMER' ? 0 : 1;
      return priority(a.type) - priority(b.type) || a.createdAt - b.createdAt;
    });

    for (const action of sorted) {
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

      notifySyncListeners({ type: 'progress', synced, failed, total: sorted.length });
    }

    // Cleanup old synced actions (keep last 24h)
    const allActions = await getAllActions();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const a of allActions) {
      if (a.status === 'synced' && a.createdAt < cutoff) {
        await deleteItem(STORES.ACTIONS, a.id);
      }
    }

    notifySyncListeners({ type: 'complete', synced, failed, total: sorted.length });
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

// ============================================
// Invoices Cache
// ============================================

export interface CachedInvoice {
  id: string;
  invoice_type: 'sale' | 'return' | 'collection';
  invoice_number: string;
  reference_id: string;
  customer_id: string | null;
  customer_name: string;
  created_by: string | null;
  created_by_name: string | null;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: 'CASH' | 'CREDIT' | null;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    consumer_price?: number;
    unit?: string;
  }>;
  notes: string | null;
  reason: string | null;
  org_name: string | null;
  legal_info: any | null;
  invoice_date: string;
  created_at: string;
}

export async function cacheInvoices(invoices: CachedInvoice[]): Promise<void> {
  await clearStore(STORES.INVOICES_CACHE);
  for (const inv of invoices) {
    await putItem(STORES.INVOICES_CACHE, inv);
  }
}

export async function getCachedInvoices(): Promise<CachedInvoice[]> {
  return getAllItems<CachedInvoice>(STORES.INVOICES_CACHE);
}

// ============================================
// Sales Cache (for collections tab)
// ============================================

export interface CachedSale {
  id: string;
  customer_id: string;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  remaining: number;
  paymentType: string;
  isVoided: boolean;
  timestamp: number;
}

export async function cacheSales(sales: CachedSale[]): Promise<void> {
  await clearStore(STORES.SALES_CACHE);
  for (const sale of sales) {
    await putItem(STORES.SALES_CACHE, sale);
  }
}

export async function getCachedSales(): Promise<CachedSale[]> {
  return getAllItems<CachedSale>(STORES.SALES_CACHE);
}

export async function updateCachedSale(saleId: string, updates: Partial<CachedSale>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SALES_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.SALES_CACHE);
    const getReq = store.get(saleId);
    
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Organization Info Cache
// ============================================

export interface CachedOrgInfo {
  key: string; // always 'org_info'
  orgName: string;
  legalInfo: {
    commercial_registration: string | null;
    industrial_registration: string | null;
    tax_identification: string | null;
    trademark_name: string | null;
  } | null;
  updatedAt: number;
}

export async function cacheOrgInfo(orgName: string, legalInfo: CachedOrgInfo['legalInfo']): Promise<void> {
  await putItem(STORES.ORG_INFO_CACHE, {
    key: 'org_info',
    orgName,
    legalInfo,
    updatedAt: Date.now(),
  });
}

export async function getCachedOrgInfo(): Promise<CachedOrgInfo | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ORG_INFO_CACHE, 'readonly');
    const req = tx.objectStore(STORES.ORG_INFO_CACHE).get('org_info');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
