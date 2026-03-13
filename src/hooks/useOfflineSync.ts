/**
 * Offline Sync Hook (Lightweight)
 * Provides online/offline status awareness to the app shell.
 * Reads real pending count from distributor offline queue when available.
 * Only loads the distributor offline engine for FIELD_AGENT / distributor roles.
 * Optimized: skips polling when no pending actions detected.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useOfflineSync(userRole?: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const hasEverHadPending = useRef(false);

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
      const count = stats.pending + stats.failed;
      setPendingCount(count);
      if (count > 0) hasEverHadPending.current = true;
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
    
    // Smart polling: 15s if we have/had pending actions, 60s otherwise
    const interval = setInterval(() => {
      if (isDistributor && (hasEverHadPending.current || !isOnline)) {
        refreshPendingCount();
      }
    }, hasEverHadPending.current ? 15_000 : 60_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, isDistributor, isOnline]);

  return {
    isOnline,
    pendingCount,
  };
}
