/**
 * Offline Sync Hook (Lightweight)
 * Provides online/offline status awareness to the app shell.
 * Reads real pending count from distributor offline queue when available.
 * Only loads the distributor offline engine for FIELD_AGENT / distributor roles.
 */

import { useState, useEffect, useCallback } from 'react';

export function useOfflineSync(userRole?: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Only distributors (FIELD_AGENT employees) need the offline engine
  const isDistributor = userRole === 'EMPLOYEE' || userRole === 'FIELD_AGENT';

  const refreshPendingCount = useCallback(async () => {
    if (!isDistributor) {
      setPendingCount(0);
      return;
    }
    try {
      const { getActionStats } = await import(
        '@/features/distributor/services/distributorOfflineService'
      );
      const stats = await getActionStats();
      setPendingCount(stats.pending + stats.failed);
    } catch {
      setPendingCount(0);
    }
  }, [isDistributor]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
