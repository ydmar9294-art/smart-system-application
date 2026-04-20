/**
 * Distributor Offline Service — Facade
 * 
 * This file re-exports the public API from the modular offline architecture.
 * It serves as the single import entry point for the rest of the application,
 * maintaining backward compatibility after the refactor.
 * 
 * Internal modules:
 * - offlineDb.ts      — IndexedDB connection, schema, generic CRUD, encryption wrappers
 * - offlineQueue.ts   — Action queue lifecycle (enqueue, update, retry, stats)
 * - offlineSync.ts    — Sync engine (bulk, sequential, retry escalation, scheduling)
 * - offlineCache.ts   — Cached data for inventory, customers, sales, invoices, org info
 * - offlineIdMap.ts   — Temporary → server ID mapping with persistence
 */

// ── Types ────────────────────────────────────────────────────────
export type {
  OfflineActionType,
  OfflineActionStatus,
  OfflineAction,
} from './offlineQueue';

export type {
  CachedInventoryItem,
  CachedCustomer,
  CachedSale,
  CachedSaleItem,
  CachedInvoice,
  CachedOrgInfo,
} from './offlineCache';

// ── Queue ────────────────────────────────────────────────────────
export {
  enqueueAction,
  getPendingActions,
  getAllActions,
  updateAction,
  retryFailedAction,
  retryAllFailedActions,
  clearSyncedActions,
  getActionStats,
  recoverStuckActions,
} from './offlineQueue';

// ── Sync ─────────────────────────────────────────────────────────
export {
  syncAllPending,
  startDistributorSync,
  stopDistributorSync,
  onSyncEvent,
  getIsSyncing,
  initOfflineSystem,
} from './offlineSync';

// ── Cache ────────────────────────────────────────────────────────
export {
  cacheInventory,
  getCachedInventory,
  updateCachedInventoryQuantity,
  cacheCustomers,
  getCachedCustomers,
  addLocalCustomer,
  updateCachedCustomerBalance,
  updateCustomerSyncStatus,
  cacheSales,
  getCachedSales,
  addLocalSale,
  updateCachedSale,
  cacheInvoices,
  getCachedInvoices,
  addLocalInvoice,
  cacheOrgInfo,
  getCachedOrgInfo,
  cacheOfflineOrgContext,
  getOfflineOrgContext,
} from './offlineCache';

// ── ID Maps ──────────────────────────────────────────────────────
export {
  getCustomerIdMap,
  getSaleIdMap,
  resolveCustomerId,
  resolveSaleId,
  persistIdMapping,
  loadPersistedIdMaps,
} from './offlineIdMap';

// ── Clear (logout) ──────────────────────────────────────────────
import { DB_NAME, resetDbConnection, openDB } from './offlineDb';
import { stopDistributorSync } from './offlineSync';
import { clearIdMaps } from './offlineIdMap';
import { logger } from '@/lib/logger';

export async function clearDistributorOfflineData(): Promise<void> {
  try {
    stopDistributorSync();
    resetDbConnection();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        logger.warn('[DistributorOffline] deleteDatabase blocked — clearing stores manually', 'DistributorOffline');
        openDB().then(db => {
          const storeNames = Array.from(db.objectStoreNames);
          if (storeNames.length === 0) { resolve(); return; }
          const tx = db.transaction(storeNames, 'readwrite');
          for (const name of storeNames) {
            tx.objectStore(name).clear();
          }
          tx.oncomplete = () => {
            db.close();
            resetDbConnection();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        }).catch(() => resolve());
      };
    });
    clearIdMaps();
    logger.info('[DistributorOffline] All offline data cleared', 'DistributorOffline');
  } catch (err) {
    logger.warn('[DistributorOffline] Failed to clear offline data', 'DistributorOffline');
  }
}
