/**
 * Offline Queue Manager (DEPRECATED)
 * 
 * This generic offline queue is no longer used.
 * The distributor offline system uses its own queue in:
 *   src/features/distributor/services/distributorOfflineService.ts
 * 
 * These exports are kept as no-ops for backward compatibility
 * in case any module still imports them.
 */

import { generateUUID } from '@/lib/uuid';

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

/** @deprecated Use distributorOfflineService instead */
export async function enqueueOperation(
  _operationType: string,
  _payload: any,
  _endpoint: string,
  _method: string = 'POST'
): Promise<string> {
  console.warn('[offlineQueue] DEPRECATED: Use distributorOfflineService.enqueueAction instead');
  return generateUUID();
}

/** @deprecated */
export async function getPendingOperations(): Promise<OfflineOperation[]> {
  return [];
}

/** @deprecated */
export async function updateOperationStatus(
  _id: string,
  _status: 'pending' | 'synced' | 'failed',
  _retryCount?: number
): Promise<void> {}

/** @deprecated */
export async function clearSyncedOperations(): Promise<void> {}

/** @deprecated */
export async function getQueueStats(): Promise<{
  pending: number;
  synced: number;
  failed: number;
}> {
  return { pending: 0, synced: 0, failed: 0 };
}

export { MAX_RETRIES };
