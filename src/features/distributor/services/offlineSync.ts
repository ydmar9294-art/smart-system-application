/**
 * Offline Sync Engine
 * 
 * Handles synchronization of queued offline actions to the server.
 * Supports bulk sync with batch limits, sequential fallback, retry escalation, and deferral.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { isEncryptionAvailable, verifyHMAC, checkAndRotateKeyIfNeeded } from '@/lib/indexedDbEncryption';
import { logStorageHealth, requestPersistentStorage } from '@/lib/storageMonitor';
import { CircuitBreaker } from '@/lib/circuitBreaker';
import {
  type OfflineAction,
  type OfflineActionType,
  getAllActionsDecrypted,
  updateAction,
  recoverStuckActions,
} from './offlineQueue';
import {
  resolveCustomerId,
  resolveSaleId,
  persistIdMapping,
  loadPersistedIdMaps,
  cleanupOldIdMaps,
} from './offlineIdMap';
import { updateCustomerSyncStatus } from './offlineCache';
import { STORES, deleteItem } from './offlineDb';

// ============================================
// Constants
// ============================================

const MAX_RETRIES = 5;
const MAX_DEFERRALS = 10;
const SYNC_TIMEOUT_MS = 30_000;
const DEFERRED_RETRY_MS = 5000;
/** Maximum actions per bulk sync batch */
const BULK_BATCH_LIMIT = 100;
/** Adaptive timer intervals */
const SYNC_INTERVAL_ACTIVE_MS = 15_000;
const SYNC_INTERVAL_IDLE_MS = 60_000;
/** Cleanup thresholds */
const SYNCED_CLEANUP_MS = 24 * 60 * 60 * 1000; // 24h
const STALE_CACHE_CLEANUP_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================
// Circuit Breaker for Sync
// ============================================

const syncCircuitBreaker = new CircuitBreaker({
  name: 'sync-engine',
  failureThreshold: 3,
  resetTimeout: 60_000,
});

// ============================================
// State
// ============================================

let isSyncing = false;
let syncLockPromise: Promise<void> | null = null;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let lastPendingCount = 0;

type SyncListener = (event: { type: 'start' | 'progress' | 'complete' | 'error'; synced?: number; failed?: number; total?: number; message?: string }) => void;
const syncListeners: Set<SyncListener> = new Set();

export function onSyncEvent(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncListeners(event: Parameters<SyncListener>[0]) {
  syncListeners.forEach(l => l(event));
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

// ============================================
// Priority & Timeout
// ============================================

function syncPriority(type: OfflineActionType): number {
  switch (type) {
    case 'ADD_CUSTOMER': return 0;
    case 'CREATE_SALE': return 1;
    case 'ADD_COLLECTION': return 2;
    case 'CREATE_RETURN': return 3;
    case 'TRANSFER_TO_WAREHOUSE': return 4;
    case 'ROUTE_VISIT': return 5;
    case 'GPS_LOG': return 6;
    default: return 7;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function getRetryDelay(retryCount: number): number {
  return Math.min(5000 * Math.pow(3, retryCount), 300_000);
}

// ============================================
// Action Execution
// ============================================

type ExecuteResult = 'synced' | 'deferred' | 'failed';

async function executeAction(action: OfflineAction): Promise<ExecuteResult> {
  try {
    if (action._signature && isEncryptionAvailable()) {
      const signableData = JSON.stringify({ type: action.type, payload: action.payload, idempotencyKey: action.idempotencyKey });
      const isValid = await verifyHMAC(signableData, action._signature);
      if (!isValid) {
        logger.error(`[Sync] REJECTED tampered action ${action.id} (${action.type}) — HMAC verification failed`, 'DistributorOffline');
        await reportTamperedAction(action, 'HMAC_MISMATCH');
        return 'failed';
      }
    } else if (!action._signature) {
      logger.warn(`[Sync] Processing unsigned action ${action.id} (${action.type}) — created without Web Crypto`, 'DistributorOffline');
    }

    return await withTimeout(executeActionInner(action), SYNC_TIMEOUT_MS, action.type);
  } catch (err: any) {
    logger.error(`[Sync] Action ${action.id} (${action.type}) failed: ${err.message}`, 'DistributorOffline');
    return 'failed';
  }
}

async function reportTamperedAction(action: OfflineAction, reason: 'MISSING_SIGNATURE' | 'HMAC_MISMATCH'): Promise<void> {
  try {
    await supabase.functions.invoke('bulk-sync', {
      body: {
        reportTampered: true,
        actionId: action.id,
        actionType: action.type,
        idempotencyKey: action.idempotencyKey,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    logger.warn('[Audit] Failed to report tampered action to server', 'DistributorOffline');
  }
}

async function executeActionInner(action: OfflineAction): Promise<ExecuteResult> {
  switch (action.type) {
    case 'CREATE_SALE': {
      const customerId = resolveCustomerId(action.payload.customerId);
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

      if (data && action.payload.localSaleId) {
        await persistIdMapping(action.payload.localSaleId, data as string, 'sale');
        logger.info(`[Sync] Sale remapped: ${action.payload.localSaleId} → ${data}`, 'DistributorOffline');
      }
      return 'synced';
    }

    case 'ADD_COLLECTION': {
      const saleId = resolveSaleId(action.payload.saleId);
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

    case 'GPS_LOG': {
      const { error } = await supabase.from('distributor_locations').insert({
        user_id: (await supabase.auth.getSession()).data.session?.user?.id,
        latitude: action.payload.latitude,
        longitude: action.payload.longitude,
        accuracy: action.payload.accuracy || null,
        organization_id: action.payload.organizationId,
        visit_type: action.payload.visitType || 'route_point',
        recorded_at: action.payload.recordedAt || new Date().toISOString(),
        is_synced: true,
        synced_at: new Date().toISOString(),
      });
      if (error) throw error;
      return 'synced';
    }

    case 'ROUTE_VISIT': {
      const { error } = await supabase.from('route_stops').update({
        status: action.payload.status,
        notes: action.payload.notes || null,
        visited_at: action.payload.visitedAt || new Date().toISOString(),
      }).eq('id', action.payload.stopId);
      if (error) throw error;
      return 'synced';
    }

    default:
      logger.warn(`[Sync] Unknown action type: ${action.type}`, 'DistributorOffline');
      return 'failed';
  }
}

// ============================================
// Stale Data Cleanup
// ============================================

async function cleanupStaleCacheData(): Promise<void> {
  try {
    const cutoff = Date.now() - STALE_CACHE_CLEANUP_MS;
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
// Bulk Sync (with batch limit)
// ============================================

async function attemptBulkSync(actions: OfflineAction[]): Promise<{ synced: number; failed: number } | null> {
  try {
    // Enforce batch limit — only send up to BULK_BATCH_LIMIT at a time
    const batch = actions.slice(0, BULK_BATCH_LIMIT);

    const operations = batch.map(a => ({
      id: a.id,
      type: a.type,
      payload: a.payload,
      idempotencyKey: a.idempotencyKey,
      _signature: a._signature,
    }));

    for (const a of batch) {
      await updateAction(a.id, { status: 'syncing' });
    }

    const { data, error } = await supabase.functions.invoke('bulk-sync', {
      body: { operations },
    });

    if (error || !data?.results) return null;

    let synced = 0;
    let failed = 0;

    if (data.idMappings) {
      for (const [localId, serverId] of Object.entries(data.idMappings.customers || {})) {
        await persistIdMapping(localId, serverId as string, 'customer');
        await updateCustomerSyncStatus(localId, 'synced', serverId as string);
      }
      for (const [localId, serverId] of Object.entries(data.idMappings.sales || {})) {
        await persistIdMapping(localId, serverId as string, 'sale');
      }
    }

    for (const result of data.results as Array<{ id: string; status: string; error?: string; serverId?: string }>) {
      if (result.status === 'synced') {
        await updateAction(result.id, { status: 'synced', syncedAt: Date.now(), error: undefined });
        synced++;
      } else if (result.status === 'deferred') {
        const action = batch.find(a => a.id === result.id);
        const newDeferral = (action?.deferralCount || 0) + 1;
        if (newDeferral >= MAX_DEFERRALS) {
          await updateAction(result.id, {
            status: 'failed',
            deferralCount: newDeferral,
            error: 'تجاوز الحد الأقصى لتأجيل العملية — العنصر المرتبط لم يُزامَن',
          });
          failed++;
        } else {
          await updateAction(result.id, {
            status: 'pending',
            deferralCount: newDeferral,
            nextRetryAt: Date.now() + DEFERRED_RETRY_MS,
          });
        }
      } else {
        const action = batch.find(a => a.id === result.id);
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
    for (const a of actions.slice(0, BULK_BATCH_LIMIT)) {
      await updateAction(a.id, { status: 'pending' });
    }
    return null;
  }
}

// ============================================
// Sequential Sync (fallback)
// ============================================

async function sequentialSync(sorted: OfflineAction[]): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const action of sorted) {
    await updateAction(action.id, { status: 'syncing' });

    const result = await executeAction(action);

    if (result === 'synced') {
      await updateAction(action.id, { status: 'synced', syncedAt: Date.now(), error: undefined, deferralCount: 0 });
      synced++;
    } else if (result === 'deferred') {
      const newDeferral = (action.deferralCount || 0) + 1;
      if (newDeferral >= MAX_DEFERRALS) {
        await updateAction(action.id, {
          status: 'failed',
          deferralCount: newDeferral,
          error: 'تجاوز الحد الأقصى لتأجيل العملية — العنصر المرتبط لم يُزامَن',
        });
        failed++;
        logger.warn(`[Sync] Action ${action.id} (${action.type}) exceeded max deferrals (${MAX_DEFERRALS}), marking failed`, 'DistributorOffline');
      } else {
        await updateAction(action.id, {
          status: 'pending',
          deferralCount: newDeferral,
          nextRetryAt: Date.now() + DEFERRED_RETRY_MS,
        });
      }
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

// ============================================
// Main Sync Orchestrator
// ============================================

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (syncLockPromise) {
    await syncLockPromise.catch(() => {});
    return { synced: 0, failed: 0 };
  }
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  let resolveLock: () => void;
  syncLockPromise = new Promise<void>(r => { resolveLock = r; });
  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const result = await syncCircuitBreaker.execute(
      async () => {
        const allDecrypted = await getAllActionsDecrypted();
        const now = Date.now();
        const pending = allDecrypted
          .filter(a => a.status === 'pending' && (!a.nextRetryAt || a.nextRetryAt <= now))
          .sort((a, b) => a.createdAt - b.createdAt);

        if (pending.length === 0) return { synced: 0, failed: 0 };

        notifySyncListeners({ type: 'start', total: pending.length });
        logger.info(`[Sync] Processing ${pending.length} pending actions`, 'DistributorOffline');

        const sorted = [...pending].sort((a, b) => {
          const pDiff = syncPriority(a.type) - syncPriority(b.type);
          return pDiff !== 0 ? pDiff : a.createdAt - b.createdAt;
        });

        // Process in batches of BULK_BATCH_LIMIT
        let totalSynced = 0;
        let totalFailed = 0;
        let remaining = sorted;

        while (remaining.length > 0) {
          const batch = remaining.slice(0, BULK_BATCH_LIMIT);
          remaining = remaining.slice(BULK_BATCH_LIMIT);

          const bulkResult = await attemptBulkSync(batch);

          if (bulkResult) {
            totalSynced += bulkResult.synced;
            totalFailed += bulkResult.failed;
          } else {
            logger.warn('[Sync] Bulk sync unavailable, falling back to sequential', 'DistributorOffline');
            const seqResult = await sequentialSync(batch);
            totalSynced += seqResult.synced;
            totalFailed += seqResult.failed;
          }
        }

        // Cleanup synced actions older than 24h
        const cutoff = Date.now() - SYNCED_CLEANUP_MS;
        for (const a of allDecrypted) {
          if (a.status === 'synced' && a.createdAt < cutoff) {
            await deleteItem(STORES.ACTIONS, a.id);
          }
        }

        await cleanupStaleCacheData();

        return { synced: totalSynced, failed: totalFailed };
      },
      () => {
        logger.warn('[Sync] Circuit breaker OPEN — skipping sync cycle', 'DistributorOffline');
        return { synced: 0, failed: 0 };
      }
    );

    synced = result.synced;
    failed = result.failed;
    lastPendingCount = failed;

    notifySyncListeners({ type: 'complete', synced, failed, total: synced + failed });
    if (synced > 0 || failed > 0) {
      logger.info(`[Sync] Done: ${synced} synced, ${failed} failed`, 'DistributorOffline');
    }
  } catch (err) {
    notifySyncListeners({ type: 'error', message: String(err) });
    logger.error('[Sync] Process error', 'DistributorOffline', { error: String(err) });
  } finally {
    isSyncing = false;
    syncLockPromise = null;
    resolveLock!();
  }

  return { synced, failed };
}

// ============================================
// Adaptive Sync Timer
// ============================================

function getAdaptiveInterval(): number {
  return lastPendingCount > 0 ? SYNC_INTERVAL_ACTIVE_MS : SYNC_INTERVAL_IDLE_MS;
}

function scheduleNextSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  const interval = getAdaptiveInterval();
  syncIntervalId = setInterval(async () => {
    await syncAllPending();
    checkAndRotateKeyIfNeeded().catch(() => {});
    // Re-schedule with potentially different interval
    const newInterval = getAdaptiveInterval();
    if (newInterval !== interval) {
      scheduleNextSync();
    }
  }, interval);
}

// ============================================
// Sync Lifecycle
// ============================================

let onlineListenerActive = false;

export async function initOfflineSystem(): Promise<void> {
  await loadPersistedIdMaps();
  await recoverStuckActions();
  await cleanupOldIdMaps();

  // Request persistent storage to prevent eviction on mobile
  requestPersistentStorage().catch(() => {});

  // Log storage health on init
  logStorageHealth().catch(() => {});
}

export function startDistributorSync(): void {
  if (syncIntervalId) return;

  checkAndRotateKeyIfNeeded().catch(() => {});

  setTimeout(syncAllPending, 2000);

  scheduleNextSync();

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
  // Reset circuit breaker on reconnect
  syncCircuitBreaker.reset();
  setTimeout(syncAllPending, 1000);
}
