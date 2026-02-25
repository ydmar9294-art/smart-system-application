/**
 * useDistributorOffline Hook
 * Provides offline-first operations and sync status for distributor components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueueAction,
  syncAllPending,
  getActionStats,
  getAllActions,
  onSyncEvent,
  startDistributorSync,
  stopDistributorSync,
  cacheInventory,
  getCachedInventory,
  updateCachedInventoryQuantity,
  type OfflineAction,
  type OfflineActionType,
  type CachedInventoryItem,
} from '../services/distributorOfflineService';
import { supabase } from '@/integrations/supabase/client';

export interface DistributorOfflineState {
  /** Pending actions count */
  pendingCount: number;
  /** Failed actions count */
  failedCount: number;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Is device online */
  isOnline: boolean;
  /** Local inventory cache */
  localInventory: CachedInventoryItem[];
  /** All offline actions for the log */
  actions: OfflineAction[];
  /** Last sync message */
  lastSyncMessage: string | null;
}

export function useDistributorOffline() {
  const [state, setState] = useState<DistributorOfflineState>({
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    isOnline: navigator.onLine,
    localInventory: [],
    actions: [],
    lastSyncMessage: null,
  });

  const mountedRef = useRef(true);

  // Refresh stats from IndexedDB
  const refreshStats = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [stats, actions, inventory] = await Promise.all([
        getActionStats(),
        getAllActions(),
        getCachedInventory(),
      ]);
      setState(prev => ({
        ...prev,
        pendingCount: stats.pending,
        failedCount: stats.failed,
        isSyncing: stats.syncing > 0,
        actions: actions.slice(0, 50), // last 50
        localInventory: inventory,
      }));
    } catch {
      // IndexedDB not available
    }
  }, []);

  // Fetch inventory from server and cache locally
  const refreshInventory = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('distributor_inventory')
        .select('product_id, product_name, quantity')
        .eq('distributor_id', user.id)
        .gt('quantity', 0);

      if (error) throw error;

      // Fetch prices
      const productIds = (data || []).map(d => d.product_id);
      if (productIds.length === 0) {
        await cacheInventory([]);
        await refreshStats();
        return;
      }

      const { data: productsData } = await supabase
        .from('products')
        .select('id, base_price, consumer_price, unit')
        .in('id', productIds);

      const priceMap = new Map(
        (productsData || []).map(p => [
          p.id,
          { base_price: Number(p.base_price), consumer_price: Number(p.consumer_price ?? 0), unit: p.unit || '' },
        ])
      );

      const items: CachedInventoryItem[] = (data || []).map(item => {
        const priceInfo = priceMap.get(item.product_id);
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          base_price: priceInfo?.base_price || 0,
          consumer_price: priceInfo?.consumer_price || 0,
          unit: priceInfo?.unit || '',
          updated_at: Date.now(),
        };
      });

      await cacheInventory(items);
      await refreshStats();
    } catch (err) {
      // If offline, use cached data — no error
      console.warn('[DistributorOffline] Inventory fetch failed, using cache');
      await refreshStats();
    }
  }, [refreshStats]);

  // Queue an offline action and apply optimistic update
  const queueAction = useCallback(async (
    type: OfflineActionType,
    payload: any,
    inventoryUpdates?: { productId: string; quantityDelta: number }[]
  ) => {
    const action = await enqueueAction(type, payload);

    // Apply optimistic inventory updates
    if (inventoryUpdates) {
      for (const update of inventoryUpdates) {
        await updateCachedInventoryQuantity(update.productId, update.quantityDelta);
      }
    }

    await refreshStats();
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      setTimeout(syncAllPending, 500);
    }

    return action;
  }, [refreshStats]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    const result = await syncAllPending();
    await refreshStats();
    // Also refresh inventory from server after sync
    if (result.synced > 0) {
      await refreshInventory();
    }
    return result;
  }, [refreshStats, refreshInventory]);

  // Initialize
  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start sync engine
    startDistributorSync();

    // Listen for sync events
    const unsub = onSyncEvent((event) => {
      if (!mountedRef.current) return;
      if (event.type === 'start') {
        setState(prev => ({ ...prev, isSyncing: true }));
      } else if (event.type === 'complete') {
        const msg = event.synced! > 0
          ? `تمت مزامنة ${event.synced} عملية بنجاح`
          : null;
        setState(prev => ({ ...prev, isSyncing: false, lastSyncMessage: msg }));
        refreshStats();
        if (event.synced! > 0) refreshInventory();
      } else if (event.type === 'error') {
        setState(prev => ({ ...prev, isSyncing: false }));
        refreshStats();
      }
    });

    // Load initial data
    refreshStats();
    refreshInventory();

    // Periodic stats refresh
    const statsInterval = setInterval(refreshStats, 30_000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopDistributorSync();
      unsub();
      clearInterval(statsInterval);
    };
  }, [refreshStats, refreshInventory]);

  return {
    ...state,
    queueAction,
    triggerSync,
    refreshInventory,
    refreshStats,
  };
}
