/**
 * Auto Sync Service
 * Automatically syncs offline operations when connectivity returns.
 * Runs on: app start, online event, periodic interval.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getPendingOperations,
  updateOperationStatus,
  clearSyncedOperations,
  MAX_RETRIES,
  type OfflineOperation,
} from './offlineQueue';

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// ============================================
// Execute a single queued operation
// ============================================

async function executeOperation(op: OfflineOperation): Promise<boolean> {
  try {
    // Use Supabase RPC calls based on operation_type for idempotency
    const { data, error } = await supabase.functions.invoke('sync-operation', {
      body: {
        operation_type: op.operation_type,
        payload: op.payload,
        idempotency_key: op.idempotency_key,
      },
    });

    if (error) {
      console.error(`[Sync] Operation ${op.id} failed:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Sync] Network error for ${op.id}:`, err);
    return false;
  }
}

// ============================================
// Sync all pending operations sequentially
// ============================================

export async function syncPendingOperations(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping...');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingOperations();

    if (pending.length === 0) {
      return { synced: 0, failed: 0 };
    }

    console.log(`[Sync] Processing ${pending.length} pending operations...`);

    for (const op of pending) {
      const success = await executeOperation(op);

      if (success) {
        await updateOperationStatus(op.id, 'synced');
        synced++;
      } else {
        const newRetry = op.retry_count + 1;
        if (newRetry >= MAX_RETRIES) {
          await updateOperationStatus(op.id, 'failed', newRetry);
          failed++;
          console.warn(`[Sync] Operation ${op.id} exceeded max retries`);
        } else {
          // Workaround: extend the type to support this
          await updateOperationStatus(op.id, 'failed', newRetry);
          await updateOperationStatus(op.id, 'pending', newRetry);
        }
      }
    }

    // Cleanup synced operations periodically
    if (synced > 0) {
      await clearSyncedOperations();
    }

    console.log(`[Sync] Complete: ${synced} synced, ${failed} failed`);
  } catch (err) {
    console.error('[Sync] Sync process error:', err);
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

// ============================================
// Start/Stop auto sync
// ============================================

export function startAutoSync(): void {
  if (syncIntervalId) return;

  console.log('[Sync] Starting auto-sync service');

  // Sync on startup
  syncPendingOperations();

  // Periodic sync
  syncIntervalId = setInterval(syncPendingOperations, SYNC_INTERVAL_MS);

  // Sync on reconnect
  window.addEventListener('online', handleOnline);
}

export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  window.removeEventListener('online', handleOnline);
  console.log('[Sync] Auto-sync service stopped');
}

function handleOnline(): void {
  console.log('[Sync] Connection restored, triggering sync...');
  syncPendingOperations();
}
