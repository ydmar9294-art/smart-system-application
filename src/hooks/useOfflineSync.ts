/**
 * Offline Sync Hook (Lightweight)
 * Provides online/offline status awareness to the app shell.
 * Reads real pending count from distributor offline queue when available.
 */

import { useState, useEffect, useCallback } from 'react';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      // Dynamically import to avoid loading distributor code for non-distributor roles
      const { getActionStats } = await import(
        '@/features/distributor/services/distributorOfflineService'
      );
      const stats = await getActionStats();
      setPendingCount(stats.pending + stats.failed);
    } catch {
      // IndexedDB or module not available — no pending actions
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending count on mount and periodically
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
  };
}
