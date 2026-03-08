/**
 * Distributor Offline Service
 * 
 * Provides offline-first operations for the distributor:
 * - Local IndexedDB cache for inventory, customers, sales, invoices
 * - Offline action queue with auto-sync
 * - Optimistic UI updates
 * - Customer & Sale ID remapping on sync
 * 
 * Architecture:
 * - All writes go to IndexedDB first (instant)
 * - Background sync pushes to Supabase when online
 * - UI always reads from local cache
 * - Sync order: Customers → Sales → Collections → Returns → Others
 * - ID maps persisted in IndexedDB to survive restarts
 */

import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { encryptData, decryptData, isEncrypted, computeHMAC, verifyHMAC, isEncryptionAvailable } from '@/lib/indexedDbEncryption';

// ============================================
// Database Setup
// ============================================

const DB_NAME = 'distributor_offline_v4';
const DB_VERSION = 4;

const STORES = {
  ACTIONS: 'offline_actions',
  INVENTORY_CACHE: 'inventory_cache',
  CUSTOMERS_CACHE: 'customers_cache',
  SALES_CACHE: 'sales_cache',
  INVOICES_CACHE: 'invoices_cache',
  ORG_INFO_CACHE: 'org_info_cache',
  ID_MAPS: 'id_maps',
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
  /** Cooldown: don't retry before this timestamp */
  nextRetryAt?: number;
  /** HMAC signature for integrity verification */
  _signature?: string;
}

// ============================================
// IndexedDB Connection (resilient)
// ============================================

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  // Reuse existing healthy connection
  if (dbInstance) {
    try {
      // Validate connection is still alive by attempting a trivial op
      dbInstance.transaction(STORES.ACTIONS, 'readonly');
      return Promise.resolve(dbInstance);
    } catch {
      // Connection is stale/closed — reset and reconnect
      dbInstance = null;
      dbOpenPromise = null;
    }
  }

  // Deduplicate concurrent open calls
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
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

      if (!db.objectStoreNames.contains(STORES.ID_MAPS)) {
        db.createObjectStore(STORES.ID_MAPS, { keyPath: 'localId' });
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

async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getItem<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// Encrypted Store Helpers (for sensitive data)
// ============================================

/** ALL data stores are now encrypted for security */
const SENSITIVE_STORES = new Set([
  STORES.INVOICES_CACHE,
  STORES.ORG_INFO_CACHE,
  STORES.SALES_CACHE,
  STORES.CUSTOMERS_CACHE,
  STORES.INVENTORY_CACHE,
]);

/**
 * Put an item into a sensitive store with encryption.
 * The item's keyPath field is preserved in plaintext for IndexedDB indexing,
 * while all other data is encrypted.
 */
async function putEncryptedItem<T extends Record<string, any>>(
  storeName: string,
  item: T,
  keyField: string = 'id'
): Promise<void> {
  const keyValue = item[keyField];
  const encrypted = await encryptData(item);
  await putItem(storeName, { [keyField]: keyValue, _enc: encrypted });
}

/**
 * Get all items from a sensitive store, decrypting each one.
 * Handles legacy unencrypted data transparently.
 */
async function getAllEncryptedItems<T>(storeName: string): Promise<T[]> {
  const raw = await getAllItems<any>(storeName);
  const results: T[] = [];
  for (const item of raw) {
    try {
      if (item._enc && isEncrypted(item._enc)) {
        results.push(await decryptData<T>(item._enc));
      } else {
        // Legacy unencrypted data — return as-is
        results.push(item as T);
      }
    } catch (err) {
      logger.warn(`[Encryption] Failed to decrypt item in ${storeName}, skipping`, 'DistributorOffline');
    }
  }
  return results;
}

/**
 * Get a single item from a sensitive store by key, decrypting it.
 */
async function getEncryptedItem<T>(storeName: string, key: string): Promise<T | null> {
  const raw = await getItem<any>(storeName, key);
  if (!raw) return null;
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      return await decryptData<T>(raw._enc);
    }
    // Legacy unencrypted
    return raw as T;
  } catch (err) {
    logger.warn(`[Encryption] Failed to decrypt item ${key} in ${storeName}`, 'DistributorOffline');
    return null;
  }
}

/**
 * ATOMIC clear-and-replace: clears a store and writes new items in a single transaction.
 * Prevents data loss if app crashes mid-write.
 */
async function atomicReplaceStore(storeName: string, items: Array<{ key: string; value: any }>): Promise<void> {
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

/**
 * Encrypt an item and return the IndexedDB-ready record.
 */
async function prepareEncryptedRecord<T extends Record<string, any>>(
  item: T,
  keyField: string = 'id'
): Promise<Record<string, any>> {
  const keyValue = item[keyField];
  const encrypted = await encryptData(item);
  return { [keyField]: keyValue, _enc: encrypted };
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
  
  // Sign the action payload for integrity verification
  if (isEncryptionAvailable()) {
    try {
      const signableData = JSON.stringify({ type: action.type, payload: action.payload, idempotencyKey: action.idempotencyKey });
      action._signature = await computeHMAC(signableData);
    } catch {
      logger.warn('Failed to sign offline action — storing unsigned', 'DistributorOffline');
    }
  }

  // Encrypt the entire action before storing
  if (isEncryptionAvailable()) {
    try {
      const encrypted = await encryptData(action);
      await putItem(STORES.ACTIONS, { id: action.id, _enc: encrypted });
    } catch {
      // Fallback: store unencrypted if encryption fails
      await putItem(STORES.ACTIONS, action);
    }
  } else {
    await putItem(STORES.ACTIONS, action);
  }
  
  logger.info(`[OfflineQueue] Enqueued ${type}`, 'DistributorOffline');
  return action;
}

/**
 * Decrypt an action record from IndexedDB.
 */
async function decryptAction(raw: any): Promise<OfflineAction | null> {
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      return await decryptData<OfflineAction>(raw._enc);
    }
    // Legacy unencrypted action
    return raw as OfflineAction;
  } catch {
    logger.warn('Failed to decrypt offline action, skipping', 'DistributorOffline');
    return null;
  }
}

/**
 * Get all raw actions and decrypt them.
 */
async function getAllActionsDecrypted(): Promise<OfflineAction[]> {
  const rawAll = await getAllItems<any>(STORES.ACTIONS);
  const results: OfflineAction[] = [];
  for (const raw of rawAll) {
    const action = await decryptAction(raw);
    if (action) results.push(action);
  }
  return results;
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const all = await getAllActionsDecrypted();
  const now = Date.now();
  return all
    .filter(a => a.status === 'pending' && (!a.nextRetryAt || a.nextRetryAt <= now))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAllActions(): Promise<OfflineAction[]> {
  const all = await getAllActionsDecrypted();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateAction(id: string, updates: Partial<OfflineAction>): Promise<void> {
  // Read and decrypt outside the write transaction
  const raw = await getItem<any>(STORES.ACTIONS, id);
  if (!raw) return;

  let existing: OfflineAction;
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      existing = await decryptData<OfflineAction>(raw._enc);
    } else {
      existing = raw as OfflineAction;
    }
  } catch {
    return;
  }

  const updated = { ...existing, ...updates };

  // Re-encrypt before storing
  if (isEncryptionAvailable()) {
    try {
      const encrypted = await encryptData(updated);
      await putItem(STORES.ACTIONS, { id: updated.id, _enc: encrypted });
      return;
    } catch {
      // fallback
    }
  }
  await putItem(STORES.ACTIONS, updated);
}

export async function retryFailedAction(id: string): Promise<void> {
  await updateAction(id, { status: 'pending', retryCount: 0, nextRetryAt: undefined });
}

export async function retryAllFailedActions(): Promise<void> {
  const all = await getAllActionsDecrypted();
  for (const action of all) {
    if (action.status === 'failed') {
      await updateAction(action.id, { status: 'pending', retryCount: 0, nextRetryAt: undefined });
    }
  }
}

export async function clearSyncedActions(): Promise<void> {
  const all = await getAllActionsDecrypted();
  const syncedIds = all.filter(a => a.status === 'synced').map(a => a.id);
  if (syncedIds.length === 0) return;

  // Atomic: delete all synced actions in a single transaction
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.ACTIONS);
    for (const id of syncedIds) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getActionStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}> {
  const all = await getAllActionsDecrypted();
  return {
    pending: all.filter(a => a.status === 'pending').length,
    syncing: all.filter(a => a.status === 'syncing').length,
    synced: all.filter(a => a.status === 'synced').length,
    failed: all.filter(a => a.status === 'failed').length,
    total: all.length,
  };
}

// ============================================
// Inventory Cache (now encrypted)
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
  // Prepare all encrypted records first, then write atomically
  const records: Array<{ key: string; value: any }> = [];
  for (const item of items) {
    const record = await prepareEncryptedRecord(
      { ...item, updated_at: Date.now() },
      'product_id'
    );
    records.push({ key: item.product_id, value: record });
  }
  await atomicReplaceStore(STORES.INVENTORY_CACHE, records);
}

export async function getCachedInventory(): Promise<CachedInventoryItem[]> {
  return getAllEncryptedItems<CachedInventoryItem>(STORES.INVENTORY_CACHE);
}

export async function updateCachedInventoryQuantity(
  productId: string,
  quantityDelta: number
): Promise<void> {
  const existing = await getEncryptedItem<CachedInventoryItem>(STORES.INVENTORY_CACHE, productId);
  if (existing) {
    existing.quantity = Math.max(0, existing.quantity + quantityDelta);
    existing.updated_at = Date.now();
    await putEncryptedItem(STORES.INVENTORY_CACHE, existing, 'product_id');
  }
}

// ============================================
// Customer Cache (now encrypted)
// ============================================

export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  balance: number;
  organization_id: string;
  created_by: string | null;
  isLocal?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  updated_at: number;
}

export async function cacheCustomers(customers: CachedCustomer[]): Promise<void> {
  // Read existing local customers BEFORE clearing
  const existing = await getAllEncryptedItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
  const localCustomers = existing.filter(c => c.isLocal && c.syncStatus !== 'synced');
  
  // Prepare all records (server + unsynced local) first
  const serverIds = new Set(customers.map(c => c.id));
  const records: Array<{ key: string; value: any }> = [];
  
  for (const c of customers) {
    const record = await prepareEncryptedRecord({ ...c, updated_at: Date.now() });
    records.push({ key: c.id, value: record });
  }
  
  // Re-add local unsynced customers that aren't on server yet
  for (const c of localCustomers) {
    if (!serverIds.has(c.id)) {
      const record = await prepareEncryptedRecord(c);
      records.push({ key: c.id, value: record });
    }
  }
  
  // ATOMIC: clear + write all in a single transaction
  await atomicReplaceStore(STORES.CUSTOMERS_CACHE, records);
}

export async function getCachedCustomers(): Promise<CachedCustomer[]> {
  return getAllEncryptedItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
}

export async function addLocalCustomer(customer: CachedCustomer): Promise<void> {
  await putEncryptedItem(STORES.CUSTOMERS_CACHE, customer);
}

export async function updateCustomerSyncStatus(
  localId: string,
  status: 'synced' | 'failed',
  serverId?: string
): Promise<void> {
  // Step 1: Read and decrypt OUTSIDE the write transaction
  // (await is safe here — we haven't opened the write tx yet)
  const raw = await getItem<any>(STORES.CUSTOMERS_CACHE, localId);
  if (!raw) return;

  let c: CachedCustomer;
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      c = await decryptData<CachedCustomer>(raw._enc);
    } else {
      c = raw;
    }
  } catch {
    logger.warn(`[CustomerSync] Failed to decrypt customer ${localId}`, 'DistributorOffline');
    return;
  }

  // Step 2: Prepare the updated + encrypted record BEFORE opening the tx
  c.syncStatus = status;
  let deleteKey: string | null = null;
  let writeRecord: Record<string, any>;

  if (status === 'synced' && serverId) {
    deleteKey = localId;
    c.id = serverId;
    c.isLocal = false;
    const encrypted = await encryptData(c);
    writeRecord = { id: serverId, _enc: encrypted };
  } else {
    const encrypted = await encryptData(c);
    writeRecord = { id: c.id, _enc: encrypted };
  }

  // Step 3: Single synchronous IDB transaction (no awaits inside)
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOMERS_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS_CACHE);
    if (deleteKey) {
      store.delete(deleteKey);
    }
    store.put(writeRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Persistent ID Maps (survive app restarts)
// ============================================

interface IdMapEntry {
  localId: string;
  serverId: string;
  type: 'customer' | 'sale';
  createdAt: number;
}

/** In-memory cache, loaded from IndexedDB on init */
const customerIdMap = new Map<string, string>();
const saleIdMap = new Map<string, string>();

export function getCustomerIdMap(): Map<string, string> {
  return customerIdMap;
}

export function getSaleIdMap(): Map<string, string> {
  return saleIdMap;
}

export function resolveCustomerId(id: string): string {
  return customerIdMap.get(id) || id;
}

export function resolveSaleId(id: string): string {
  return saleIdMap.get(id) || id;
}

/** Persist an ID mapping to IndexedDB + in-memory */
async function persistIdMapping(localId: string, serverId: string, type: 'customer' | 'sale'): Promise<void> {
  const map = type === 'customer' ? customerIdMap : saleIdMap;
  map.set(localId, serverId);
  
  await putItem(STORES.ID_MAPS, {
    localId,
    serverId,
    type,
    createdAt: Date.now(),
  } as IdMapEntry);
}

/** Load all persisted ID maps from IndexedDB into memory */
export async function loadPersistedIdMaps(): Promise<void> {
  try {
    const entries = await getAllItems<IdMapEntry>(STORES.ID_MAPS);
    for (const entry of entries) {
      if (entry.type === 'customer') {
        customerIdMap.set(entry.localId, entry.serverId);
      } else if (entry.type === 'sale') {
        saleIdMap.set(entry.localId, entry.serverId);
      }
    }
    if (entries.length > 0) {
      logger.info(`[IDMap] Loaded ${entries.length} persisted ID mappings`, 'DistributorOffline');
    }
  } catch {
    // IndexedDB not available
  }

  // Crash recovery: reset any stuck "syncing" actions back to "pending"
  await recoverStuckActions();
  
  // Cleanup old ID maps (older than 7 days)
  await cleanupOldIdMaps();
}

/**
 * Crash recovery: If app was killed mid-sync, actions stuck in "syncing" 
 * status will never complete. Reset them back to "pending".
 */
export async function recoverStuckActions(): Promise<void> {
  try {
    const all = await getAllActionsDecrypted();
    let recovered = 0;
    for (const action of all) {
      if (action.status === 'syncing') {
        await updateAction(action.id, { status: 'pending' });
        recovered++;
      }
    }
    if (recovered > 0) {
      logger.info(`[CrashRecovery] Recovered ${recovered} stuck actions`, 'DistributorOffline');
    }
  } catch {
    // non-critical
  }
}

/**
 * Clean up old ID mappings (>7 days) from both IndexedDB and in-memory maps.
 * Prevents unbounded memory growth.
 */
async function cleanupOldIdMaps(): Promise<void> {
  try {
    const entries = await getAllItems<IdMapEntry>(STORES.ID_MAPS);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    let cleaned = 0;
    
    for (const entry of entries) {
      if (entry.createdAt < cutoff) {
        await deleteItem(STORES.ID_MAPS, entry.localId);
        if (entry.type === 'customer') {
          customerIdMap.delete(entry.localId);
        } else {
          saleIdMap.delete(entry.localId);
        }
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`[IDMap] Cleaned ${cleaned} old ID mappings`, 'DistributorOffline');
    }
  } catch {
    // non-critical
  }
}

/**
 * Clean up stale cached data (>30 days) to prevent unbounded storage growth.
 * Called periodically during sync.
 */
async function cleanupStaleCacheData(): Promise<void> {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Clean old synced actions
    const allActions = await getAllActionsDecrypted();
    for (const a of allActions) {
      if (a.status === 'synced' && a.createdAt < cutoff) {
        await deleteItem(STORES.ACTIONS, a.id);
      }
    }
  } catch {
    // non-critical
  }
}

// ============================================
// Sync Engine
// ============================================

const MAX_RETRIES = 5;
let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

type SyncListener = (event: { type: 'start' | 'progress' | 'complete' | 'error'; synced?: number; failed?: number; total?: number; message?: string }) => void;
const syncListeners: Set<SyncListener> = new Set();

export function onSyncEvent(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncListeners(event: Parameters<SyncListener>[0]) {
  syncListeners.forEach(l => l(event));
}

/** Priority ordering for sync types: customers first, then sales, then collections/returns */
function syncPriority(type: OfflineActionType): number {
  switch (type) {
    case 'ADD_CUSTOMER': return 0;
    case 'CREATE_SALE': return 1;
    case 'ADD_COLLECTION': return 2;
    case 'CREATE_RETURN': return 3;
    case 'TRANSFER_TO_WAREHOUSE': return 4;
    default: return 5;
  }
}

type ExecuteResult = 'synced' | 'deferred' | 'failed';

const SYNC_TIMEOUT_MS = 30_000; // 30s per operation

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function executeAction(action: OfflineAction): Promise<ExecuteResult> {
  try {
    // MANDATORY HMAC verification — reject unsigned or tampered actions
    if (!action._signature) {
      logger.error(`[Sync] REJECTED unsigned action ${action.id} (${action.type}) — missing HMAC signature`, 'DistributorOffline');
      return 'failed';
    }
    if (isEncryptionAvailable()) {
      const signableData = JSON.stringify({ type: action.type, payload: action.payload, idempotencyKey: action.idempotencyKey });
      const isValid = await verifyHMAC(signableData, action._signature);
      if (!isValid) {
        logger.error(`[Sync] REJECTED tampered action ${action.id} (${action.type}) — HMAC verification failed`, 'DistributorOffline');
        return 'failed';
      }
    }

    return await withTimeout(executeActionInner(action), SYNC_TIMEOUT_MS, action.type);
  } catch (err: any) {
    logger.error(`[Sync] Action ${action.id} (${action.type}) failed: ${err.message}`, 'DistributorOffline');
    return 'failed';
  }
}

async function executeActionInner(action: OfflineAction): Promise<ExecuteResult> {
  switch (action.type) {
      case 'CREATE_SALE': {
        const customerId = resolveCustomerId(action.payload.customerId);

        // If customer ID is still local (unresolved), defer until customer syncs
        if (customerId.startsWith('local_')) {
          logger.info(`[Sync] Deferring CREATE_SALE — customer ${customerId} not yet synced`, 'DistributorOffline');
          return 'deferred';
        }

        const { data, error } = await supabase.rpc('create_distributor_sale_rpc', {
          p_customer_id: customerId,
          p_items: action.payload.items,
          p_payment_type: action.payload.paymentType || 'CASH',
          p_discount_type: action.payload.discountType || null,
          p_discount_percentage: action.payload.discountPercentage || 0,
          p_discount_value: action.payload.discountValue || 0,
        });
        if (error) throw error;

        // Map local sale ID → server sale ID
        if (data && action.payload.localSaleId) {
          await persistIdMapping(action.payload.localSaleId, data as string, 'sale');
          logger.info(`[Sync] Sale remapped: ${action.payload.localSaleId} → ${data}`, 'DistributorOffline');
        }
        return 'synced';
      }

      case 'ADD_COLLECTION': {
        const saleId = resolveSaleId(action.payload.saleId);

        // If sale ID is still local, defer until sale syncs
        if (saleId.startsWith('local_')) {
          logger.info(`[Sync] Deferring ADD_COLLECTION — sale ${saleId} not yet synced`, 'DistributorOffline');
          return 'deferred';
        }

        const { error } = await supabase.rpc('add_collection_rpc', {
          p_sale_id: saleId,
          p_amount: action.payload.amount,
          p_notes: action.payload.notes || null,
        });
        if (error) throw error;
        return 'synced';
      }

      case 'CREATE_RETURN': {
        const saleId = resolveSaleId(action.payload.saleId);

        if (saleId.startsWith('local_')) {
          logger.info(`[Sync] Deferring CREATE_RETURN — sale ${saleId} not yet synced`, 'DistributorOffline');
          return 'deferred';
        }

        const { error } = await supabase.rpc('create_distributor_return_rpc', {
          p_sale_id: saleId,
          p_items: action.payload.items,
          p_reason: action.payload.reason || null,
        });
        if (error) throw error;
        return 'synced';
      }

      case 'TRANSFER_TO_WAREHOUSE': {
        const { error } = await supabase.rpc('transfer_to_main_warehouse_rpc', {
          p_items: action.payload.items,
        });
        if (error) throw error;
        return 'synced';
      }

      case 'ADD_CUSTOMER': {
        const { data, error } = await supabase.from('customers').insert({
          name: action.payload.name,
          phone: action.payload.phone,
          location: action.payload.location,
          organization_id: action.payload.organizationId,
          created_by: action.payload.createdBy,
        }).select('id').single();

        if (error) throw error;

        if (data?.id && action.payload.localId) {
          await persistIdMapping(action.payload.localId, data.id, 'customer');
          await updateCustomerSyncStatus(action.payload.localId, 'synced', data.id);
          logger.info(`[Sync] Customer remapped: ${action.payload.localId} → ${data.id}`, 'DistributorOffline');
        }
        return 'synced';
      }

      default:
        logger.warn(`[Sync] Unknown action type: ${action.type}`, 'DistributorOffline');
        return 'failed';
    }
}

/** Calculate exponential backoff delay: 5s, 15s, 45s, 120s, 300s */
function getRetryDelay(retryCount: number): number {
  return Math.min(5000 * Math.pow(3, retryCount), 300_000);
}

const DEFERRED_RETRY_MS = 5000;

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    // ID maps already loaded by startDistributorSync; skip redundant load
    const pending = await getPendingActions();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    notifySyncListeners({ type: 'start', total: pending.length });
    logger.info(`[Sync] Processing ${pending.length} pending actions`, 'DistributorOffline');

    // Sort by dependency priority, then by creation time
    const sorted = [...pending].sort((a, b) => {
      const pDiff = syncPriority(a.type) - syncPriority(b.type);
      return pDiff !== 0 ? pDiff : a.createdAt - b.createdAt;
    });

    // Try bulk sync first (batched server-side processing)
    const bulkResult = await attemptBulkSync(sorted);
    
    if (bulkResult) {
      synced = bulkResult.synced;
      failed = bulkResult.failed;
    } else {
      // Fallback to sequential sync if bulk endpoint fails
      logger.warn('[Sync] Bulk sync unavailable, falling back to sequential', 'DistributorOffline');
      const seqResult = await sequentialSync(sorted);
      synced = seqResult.synced;
      failed = seqResult.failed;
    }

    // Cleanup old synced actions (keep last 24h)
    const allActions = await getAllActions();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const a of allActions) {
      if (a.status === 'synced' && a.createdAt < cutoff) {
        await deleteItem(STORES.ACTIONS, a.id);
      }
    }
    
    // Periodic stale data cleanup
    await cleanupStaleCacheData();

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

/** Attempt to sync all actions via the bulk-sync edge function */
async function attemptBulkSync(actions: OfflineAction[]): Promise<{ synced: number; failed: number } | null> {
  try {
    const operations = actions.map(a => ({
      id: a.id,
      type: a.type,
      payload: a.payload,
      idempotencyKey: a.idempotencyKey,
    }));

    // Mark all as syncing
    for (const a of actions) {
      await updateAction(a.id, { status: 'syncing' });
    }

    const { data, error } = await supabase.functions.invoke('bulk-sync', {
      body: { operations },
    });

    if (error || !data?.results) return null;

    let synced = 0;
    let failed = 0;

    // Process ID mappings from server
    if (data.idMappings) {
      for (const [localId, serverId] of Object.entries(data.idMappings.customers || {})) {
        await persistIdMapping(localId, serverId as string, 'customer');
        await updateCustomerSyncStatus(localId, 'synced', serverId as string);
      }
      for (const [localId, serverId] of Object.entries(data.idMappings.sales || {})) {
        await persistIdMapping(localId, serverId as string, 'sale');
      }
    }

    // Process per-operation results
    for (const result of data.results as Array<{ id: string; status: string; error?: string; serverId?: string }>) {
      if (result.status === 'synced') {
        await updateAction(result.id, { status: 'synced', syncedAt: Date.now(), error: undefined });
        synced++;
      } else if (result.status === 'deferred') {
        await updateAction(result.id, {
          status: 'pending',
          nextRetryAt: Date.now() + DEFERRED_RETRY_MS,
        });
      } else {
        const action = actions.find(a => a.id === result.id);
        const newRetry = (action?.retryCount || 0) + 1;
        if (newRetry >= MAX_RETRIES) {
          await updateAction(result.id, {
            status: 'failed',
            retryCount: newRetry,
            error: result.error || 'تجاوز الحد الأقصى للمحاولات',
          });
          failed++;
        } else {
          const delay = getRetryDelay(newRetry);
          await updateAction(result.id, {
            status: 'pending',
            retryCount: newRetry,
            nextRetryAt: Date.now() + delay,
          });
        }
      }
    }

    return { synced, failed };
  } catch (err) {
    logger.warn('[Sync] Bulk sync request failed, will fallback', 'DistributorOffline', { error: String(err) });
    // Reset actions back to pending on bulk failure
    for (const a of actions) {
      await updateAction(a.id, { status: 'pending' });
    }
    return null;
  }
}

/** Sequential fallback sync (original behavior) */
async function sequentialSync(sorted: OfflineAction[]): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const action of sorted) {
    await updateAction(action.id, { status: 'syncing' });

    const result = await executeAction(action);

    if (result === 'synced') {
      await updateAction(action.id, { status: 'synced', syncedAt: Date.now(), error: undefined });
      synced++;
    } else if (result === 'deferred') {
      await updateAction(action.id, {
        status: 'pending',
        nextRetryAt: Date.now() + DEFERRED_RETRY_MS,
      });
    } else {
      const newRetry = action.retryCount + 1;
      if (newRetry >= MAX_RETRIES) {
        await updateAction(action.id, {
          status: 'failed',
          retryCount: newRetry,
          error: 'تجاوز الحد الأقصى للمحاولات',
        });
        failed++;
      } else {
        const delay = getRetryDelay(newRetry);
        await updateAction(action.id, {
          status: 'pending',
          retryCount: newRetry,
          nextRetryAt: Date.now() + delay,
        });
      }
    }

    notifySyncListeners({ type: 'progress', synced, failed, total: sorted.length });
  }

  return { synced, failed };
}

let onlineListenerActive = false;

export function startDistributorSync(): void {
  if (syncIntervalId) return;
  
  // Load ID maps immediately
  loadPersistedIdMaps();
  
  // Initial sync after short delay
  setTimeout(syncAllPending, 2000);
  
  // Periodic sync every 90s
  syncIntervalId = setInterval(syncAllPending, 90_000);
  
  // Sync on reconnect (only add once)
  if (!onlineListenerActive) {
    window.addEventListener('online', handleOnline);
    onlineListenerActive = true;
  }
}

export function stopDistributorSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (onlineListenerActive) {
    window.removeEventListener('online', handleOnline);
    onlineListenerActive = false;
  }
}

function handleOnline(): void {
  logger.info('[Sync] Connection restored, syncing...', 'DistributorOffline');
  setTimeout(syncAllPending, 1000);
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

/**
 * Clear all distributor offline data (call on logout).
 * Deletes the entire IndexedDB database to ensure no data leaks between sessions.
 */
export async function clearDistributorOfflineData(): Promise<void> {
  try {
    stopDistributorSync();
    // Close existing connection
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
      dbOpenPromise = null;
    }
    // Delete the entire database
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // proceed even if blocked
    });
    // Clear in-memory maps
    customerIdMap.clear();
    saleIdMap.clear();
    logger.info('[DistributorOffline] All offline data cleared', 'DistributorOffline');
  } catch (err) {
    logger.warn('[DistributorOffline] Failed to clear offline data', 'DistributorOffline');
  }
}

// ============================================
// Sales Cache (encrypted, atomic writes)
// ============================================

export interface CachedSaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

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
  /** Sale line items — cached for offline returns */
  items?: CachedSaleItem[];
  /** True if created offline, not yet synced */
  isLocal?: boolean;
}

export async function cacheSales(sales: CachedSale[]): Promise<void> {
  // Preserve local (unsynced) sales during server refresh
  const existing = await getAllEncryptedItems<CachedSale>(STORES.SALES_CACHE);
  const localSales = existing.filter(s => s.isLocal);
  
  // Prepare all records first
  const records: Array<{ key: string; value: any }> = [];
  
  for (const s of sales) {
    const record = await prepareEncryptedRecord(s);
    records.push({ key: s.id, value: record });
  }
  
  // Re-add local unsynced sales
  const serverIds = new Set(sales.map(s => s.id));
  for (const s of localSales) {
    const mappedId = saleIdMap.get(s.id);
    if (mappedId && serverIds.has(mappedId)) continue;
    if (!serverIds.has(s.id)) {
      const record = await prepareEncryptedRecord(s);
      records.push({ key: s.id, value: record });
    }
  }
  
  // ATOMIC: clear + write all in a single transaction
  await atomicReplaceStore(STORES.SALES_CACHE, records);
}

export async function getCachedSales(): Promise<CachedSale[]> {
  return getAllEncryptedItems<CachedSale>(STORES.SALES_CACHE);
}

export async function addLocalSale(sale: CachedSale): Promise<void> {
  await putEncryptedItem(STORES.SALES_CACHE, sale);
}

export async function updateCachedSale(saleId: string, updates: Partial<CachedSale>): Promise<void> {
  const existing = await getEncryptedItem<CachedSale>(STORES.SALES_CACHE, saleId);
  if (existing) {
    await putEncryptedItem(STORES.SALES_CACHE, { ...existing, ...updates });
  }
}

// ============================================
// Invoices Cache (encrypted, atomic writes)
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
    product_id?: string;
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
  /** True if created offline, not yet synced */
  isLocal?: boolean;
  /** Discount fields */
  discount_type?: 'percentage' | 'fixed' | null;
  discount_percentage?: number;
  discount_value?: number;
  subtotal?: number;
}

export async function cacheInvoices(invoices: CachedInvoice[]): Promise<void> {
  // Preserve local (unsynced) invoices during server refresh
  const existing = await getAllEncryptedItems<CachedInvoice>(STORES.INVOICES_CACHE);
  const localInvoices = existing.filter(inv => inv.isLocal);
  
  // Prepare all records first
  const records: Array<{ key: string; value: any }> = [];
  
  for (const inv of invoices) {
    const record = await prepareEncryptedRecord(inv);
    records.push({ key: inv.id, value: record });
  }
  
  // Re-add local unsynced invoices
  const serverIds = new Set(invoices.map(inv => inv.id));
  for (const inv of localInvoices) {
    const mappedId = saleIdMap.get(inv.id);
    if (mappedId && serverIds.has(mappedId)) continue;
    if (!serverIds.has(inv.id)) {
      const record = await prepareEncryptedRecord(inv);
      records.push({ key: inv.id, value: record });
    }
  }
  
  // ATOMIC: clear + write all in a single transaction
  await atomicReplaceStore(STORES.INVOICES_CACHE, records);
}

export async function getCachedInvoices(): Promise<CachedInvoice[]> {
  return getAllEncryptedItems<CachedInvoice>(STORES.INVOICES_CACHE);
}

export async function addLocalInvoice(invoice: CachedInvoice): Promise<void> {
  await putEncryptedItem(STORES.INVOICES_CACHE, invoice);
}

// ============================================
// Organization Info Cache (Encrypted)
// ============================================

export interface CachedOrgInfo {
  key: string; // 'org_info' | 'org_context'
  orgName?: string;
  legalInfo?: {
    commercial_registration: string | null;
    industrial_registration: string | null;
    tax_identification: string | null;
    trademark_name: string | null;
    stamp_url?: string | null;
  } | null;
  organizationId?: string;
  distributorId?: string;
  updatedAt: number;
}

/**
 * Convert an image URL to a base64 data URL for offline use.
 * Falls back to the original URL if conversion fails.
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function cacheOrgInfo(
  orgName: string,
  legalInfo: {
    commercial_registration: string | null;
    industrial_registration: string | null;
    tax_identification: string | null;
    trademark_name: string | null;
    stamp_url?: string | null;
  } | null,
  organizationId?: string,
  distributorId?: string,
): Promise<void> {
  // Convert stamp URL to base64 data URL for offline rendering
  let processedLegalInfo = legalInfo;
  if (legalInfo?.stamp_url && !legalInfo.stamp_url.startsWith('data:')) {
    try {
      const base64Stamp = await imageUrlToBase64(legalInfo.stamp_url);
      processedLegalInfo = { ...legalInfo, stamp_url: base64Stamp };
    } catch {
      // Keep original URL as fallback
    }
  }

  await putEncryptedItem(STORES.ORG_INFO_CACHE, {
    key: 'org_info',
    orgName,
    legalInfo: processedLegalInfo,
    organizationId,
    distributorId,
    updatedAt: Date.now(),
  }, 'key');
}

export async function getCachedOrgInfo(): Promise<CachedOrgInfo | null> {
  return getEncryptedItem<CachedOrgInfo>(STORES.ORG_INFO_CACHE, 'org_info');
}

export async function cacheOfflineOrgContext(organizationId: string, distributorId: string): Promise<void> {
  await putEncryptedItem(STORES.ORG_INFO_CACHE, {
    key: 'org_context',
    organizationId,
    distributorId,
    updatedAt: Date.now(),
  } as CachedOrgInfo, 'key');
}

export async function getOfflineOrgContext(): Promise<{ organizationId: string; distributorId: string } | null> {
  const ctx = await getEncryptedItem<CachedOrgInfo>(STORES.ORG_INFO_CACHE, 'org_context');
  if (!ctx?.organizationId || !ctx?.distributorId) return null;
  return {
    organizationId: ctx.organizationId,
    distributorId: ctx.distributorId,
  };
}
