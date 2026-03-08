/**
 * Auto Sync Service (DEPRECATED)
 * 
 * This generic sync service is no longer used.
 * The distributor offline system uses its own sync engine in:
 *   src/features/distributor/services/distributorOfflineService.ts
 * 
 * These exports are kept as no-ops for backward compatibility.
 */

/** @deprecated Use distributorOfflineService.syncAllPending instead */
export async function syncPendingOperations(): Promise<{
  synced: number;
  failed: number;
}> {
  return { synced: 0, failed: 0 };
}

/** @deprecated Use distributorOfflineService.startDistributorSync instead */
export function startAutoSync(): void {}

/** @deprecated Use distributorOfflineService.stopDistributorSync instead */
export function stopAutoSync(): void {}
