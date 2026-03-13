/**
 * Offline Action Queue
 * 
 * Manages the lifecycle of offline actions: enqueue, read, update, retry, clear.
 * Actions are encrypted at rest with HMAC integrity signatures.
 */

import { generateUUID } from '@/lib/uuid';
import { encryptData, decryptData, isEncrypted, isEncryptionAvailable, computeHMAC } from '@/lib/indexedDbEncryption';
import { logger } from '@/lib/logger';
import { STORES, putItem, getAllItems, getItem, deleteItem, openDB } from './offlineDb';

// ============================================
// Types (re-exported from facade)
// ============================================

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
  nextRetryAt?: number;
  _signature?: string;
  deferralCount?: number;
}

// ============================================
// Enqueue
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
    } catch (err) {
      logger.warn('Failed to sign offline action — will store without signature', 'DistributorOffline');
    }
  } else {
    logger.warn('Web Crypto unavailable — offline action stored without HMAC signature', 'DistributorOffline');
  }

  // Encrypt the entire action; keep `status` in plaintext for index-based counting
  if (isEncryptionAvailable()) {
    try {
      const encrypted = await encryptData(action);
      await putItem(STORES.ACTIONS, { id: action.id, status: action.status, _enc: encrypted });
    } catch {
      await putItem(STORES.ACTIONS, action);
    }
  } else {
    await putItem(STORES.ACTIONS, action);
  }

  logger.info(`[OfflineQueue] Enqueued ${type}`, 'DistributorOffline');
  return action;
}

// ============================================
// Decrypt helpers
// ============================================

export async function decryptAction(raw: any): Promise<OfflineAction | null> {
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      return await decryptData<OfflineAction>(raw._enc);
    }
    return raw as OfflineAction;
  } catch {
    logger.warn('Failed to decrypt offline action, skipping', 'DistributorOffline');
    return null;
  }
}

export async function getAllActionsDecrypted(): Promise<OfflineAction[]> {
  const rawAll = await getAllItems<any>(STORES.ACTIONS);
  const results: OfflineAction[] = [];
  for (const raw of rawAll) {
    const action = await decryptAction(raw);
    if (action) results.push(action);
  }
  return results;
}

// ============================================
// Read helpers
// ============================================

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

// ============================================
// Update / Retry
// ============================================

export async function updateAction(id: string, updates: Partial<OfflineAction>): Promise<void> {
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

  if (isEncryptionAvailable()) {
    try {
      const encrypted = await encryptData(updated);
      await putItem(STORES.ACTIONS, { id: updated.id, status: updated.status, _enc: encrypted });
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

// ============================================
// Stats (optimized — no decryption)
// ============================================

export async function getActionStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}> {
  const raw = await getAllItems<{ id: string; status?: string; _enc?: any }>(STORES.ACTIONS);
  const stats = { pending: 0, syncing: 0, synced: 0, failed: 0, total: raw.length };
  for (const item of raw) {
    const status = item.status;
    if (status === 'pending') stats.pending++;
    else if (status === 'syncing') stats.syncing++;
    else if (status === 'synced') stats.synced++;
    else if (status === 'failed') stats.failed++;
  }
  return stats;
}

// ============================================
// Crash Recovery
// ============================================

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
