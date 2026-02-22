/**
 * Offline Sync Hook
 * Provides offline status awareness and queue management to components.
 */

import { useState, useEffect, useCallback } from 'react';
import { enqueueOperation, getQueueStats } from '@/lib/offlineQueue';
import { startAutoSync, stopAutoSync, syncPendingOperations } from '@/lib/syncService';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start auto sync
    startAutoSync();

    // Refresh stats periodically
    const refreshStats = async () => {
      try {
        const stats = await getQueueStats();
        setPendingCount(stats.pending);
      } catch {
        // IndexedDB not available
      }
    };

    refreshStats();
    const statsInterval = setInterval(refreshStats, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(statsInterval);
      stopAutoSync();
    };
  }, []);

  const queueOperation = useCallback(
    async (type: string, payload: any, endpoint: string, method = 'POST') => {
      const id = await enqueueOperation(type, payload, endpoint, method);
      const stats = await getQueueStats();
      setPendingCount(stats.pending);
      return id;
    },
    []
  );

  const triggerSync = useCallback(async () => {
    const result = await syncPendingOperations();
    const stats = await getQueueStats();
    setPendingCount(stats.pending);
    return result;
  }, []);

  return {
    isOnline,
    pendingCount,
    queueOperation,
    triggerSync,
  };
}
