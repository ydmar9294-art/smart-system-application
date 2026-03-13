/**
 * Offline ID Map Service
 * 
 * Maps temporary client-generated IDs → server-assigned IDs.
 * Persisted in IndexedDB to survive app restarts.
 */

import { logger } from '@/lib/logger';
import { STORES, putItem, getAllItems, deleteItem } from './offlineDb';

// ============================================
// Types
// ============================================

interface IdMapEntry {
  localId: string;
  serverId: string;
  type: 'customer' | 'sale';
  createdAt: number;
}

// ============================================
// In-Memory Cache
// ============================================

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
export async function persistIdMapping(localId: string, serverId: string, type: 'customer' | 'sale'): Promise<void> {
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
}

/** Clean up old ID mappings (>7 days) */
export async function cleanupOldIdMaps(): Promise<void> {
  try {
    const entries = await getAllItems<IdMapEntry>(STORES.ID_MAPS);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
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

/** Clear all in-memory ID maps (on logout). */
export function clearIdMaps(): void {
  customerIdMap.clear();
  saleIdMap.clear();
}
