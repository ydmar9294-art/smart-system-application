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
  cacheSales,
  getCachedSales,
  updateCachedSale,
  type OfflineAction,
  type OfflineActionType,
  type CachedInventoryItem,
  type CachedSale,
} from '../services/distributorOfflineService';
import { supabase } from '@/integrations/supabase/client';

export interface DistributorOfflineState {
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  localInventory: CachedInventoryItem[];
  localSales: CachedSale[];
  actions: OfflineAction[];
  lastSyncMessage: string | null;
}

export function useDistributorOffline() {
  const [state, setState] = useState<DistributorOfflineState>({
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    isOnline: navigator.onLine,
    localInventory: [],
    localSales: [],
    actions: [],
    lastSyncMessage: null,
  });

  const mountedRef = useRef(true);

  // Refresh stats from IndexedDB
  const refreshStats = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [stats, actions, inventory, sales] = await Promise.all([
        getActionStats(),
        getAllActions(),
        getCachedInventory(),
        getCachedSales(),
      ]);
      setState(prev => ({
        ...prev,
        pendingCount: stats.pending,
        failedCount: stats.failed,
        isSyncing: stats.syncing > 0,
        actions: actions.slice(0, 50),
        localInventory: inventory,
        localSales: sales,
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

  // Fetch sales from server and cache locally
  const refreshSales = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sales')
        .select('id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, is_voided, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: CachedSale[] = (data || []).map(s => ({
        id: s.id,
        customer_id: s.customer_id,
        customerName: s.customer_name,
        grandTotal: Number(s.grand_total),
        paidAmount: Number(s.paid_amount),
        remaining: Number(s.remaining),
        paymentType: s.payment_type,
        isVoided: s.is_voided,
        timestamp: new Date(s.created_at).getTime(),
      }));

      await cacheSales(mapped);
      await refreshStats();
    } catch {
      console.warn('[DistributorOffline] Sales fetch failed, using cache');
      await refreshStats();
    }
  }, [refreshStats]);

  // Queue an offline action and apply optimistic update
  const queueAction = useCallback(async (
    type: OfflineActionType,
    payload: any,
    inventoryUpdates?: { productId: string; quantityDelta: number }[],
    saleUpdate?: { saleId: string; paidDelta: number }
  ) => {
    const action = await enqueueAction(type, payload);

    // Apply optimistic inventory updates
    if (inventoryUpdates) {
      for (const update of inventoryUpdates) {
        await updateCachedInventoryQuantity(update.productId, update.quantityDelta);
      }
    }

    // Apply optimistic sale updates (for collections)
    if (saleUpdate) {
      const sales = await getCachedSales();
      const sale = sales.find(s => s.id === saleUpdate.saleId);
      if (sale) {
        await updateCachedSale(saleUpdate.saleId, {
          paidAmount: sale.paidAmount + saleUpdate.paidDelta,
          remaining: Math.max(0, sale.remaining - saleUpdate.paidDelta),
        });
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
    if (result.synced > 0) {
      await refreshInventory();
      await refreshSales();
    }
    return result;
  }, [refreshStats, refreshInventory, refreshSales]);

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
        if (event.synced! > 0) {
          refreshInventory();
          refreshSales();
        }
      } else if (event.type === 'error') {
        setState(prev => ({ ...prev, isSyncing: false }));
        refreshStats();
      }
    });

    // Load initial data
    refreshStats();
    refreshInventory();
    refreshSales();

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
  }, [refreshStats, refreshInventory, refreshSales]);

  return {
    ...state,
    queueAction,
    triggerSync,
    refreshInventory,
    refreshStats,
  };
}
