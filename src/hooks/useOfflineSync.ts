/**
 * Offline Sync Hook (Lightweight)
 * Provides online/offline status awareness to the app shell.
 * 
 * NOTE: The distributor's full offline system lives in
 * useDistributorOffline + distributorOfflineService.
 * This hook is only for the global OfflineIndicator banner.
 */

import { useState, useEffect } from 'react';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    pendingCount: 0, // Distributor pending count is managed by OfflineSyncBanner
  };
}
