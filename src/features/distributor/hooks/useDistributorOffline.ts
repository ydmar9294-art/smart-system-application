/**
 * useDistributorOffline Hook
 * Provides offline-first operations and sync status for distributor components.
 * Includes: inventory, customers, sales caching + offline add customer with ID remapping.
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
  loadPersistedIdMaps,
  cacheOfflineOrgContext,
  getOfflineOrgContext,
  cacheOrgInfo,
  getCachedOrgInfo,
  cacheInventory,
  getCachedInventory,
  updateCachedInventoryQuantity,
  cacheSales,
  getCachedSales,
  updateCachedSale,
  addLocalSale,
  cacheCustomers,
  getCachedCustomers,
  addLocalCustomer,
  addLocalInvoice,
  retryFailedAction,
  retryAllFailedActions,
  type OfflineAction,
  type OfflineActionType,
  type CachedInventoryItem,
  type CachedSale,
  type CachedCustomer,
  type CachedInvoice,
} from '../services/distributorOfflineService';
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from '@/lib/uuid';

export interface DistributorOfflineState {
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  localInventory: CachedInventoryItem[];
  localSales: CachedSale[];
  localCustomers: CachedCustomer[];
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
    localCustomers: [],
    actions: [],
    lastSyncMessage: null,
  });

  const mountedRef = useRef(true);

  // Refresh stats from IndexedDB
  const refreshStats = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [stats, actions, inventory, sales, customers] = await Promise.all([
        getActionStats(),
        getAllActions(),
        getCachedInventory(),
        getCachedSales(),
        getCachedCustomers(),
      ]);
      setState(prev => ({
        ...prev,
        pendingCount: stats.pending,
        failedCount: stats.failed,
        isSyncing: stats.syncing > 0,
        actions: actions.slice(0, 50),
        localInventory: inventory,
        localSales: sales,
        localCustomers: customers,
      }));
    } catch {
      // IndexedDB not available
    }
  }, []);

  const resolveOfflineOrgContext = useCallback(async (): Promise<{ organizationId: string; distributorId: string } | null> => {
    // Always try cached context first (instant, works offline)
    const cached = await getOfflineOrgContext();
    if (cached) return cached;

    // No cache yet — try server (first-time use only)
    if (!navigator.onLine) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();

      if (profile?.organization_id) {
        await cacheOfflineOrgContext(profile.organization_id, session.user.id);
        return { organizationId: profile.organization_id, distributorId: session.user.id };
      }
    } catch {
      // no network
    }

    return null;
  }, []);

  // Fetch inventory from server and cache locally
  // ALWAYS loads from IndexedDB first (offline-first), then background refreshes from server
  const refreshInventory = useCallback(async () => {
    // Step 1: Always load from local cache first (instant, works offline)
    await refreshStats();

    // Step 2: If online, background-refresh from server to enhance data
    if (!navigator.onLine) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('distributor_inventory')
        .select('product_id, product_name, quantity')
        .eq('distributor_id', session.user.id)
        .gt('quantity', 0);

      if (error) throw error;

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
      console.warn('[DistributorOffline] Inventory fetch failed, using cache');
    }
  }, [refreshStats]);

  // Fetch customers from server and cache locally (offline-first)
  const refreshCustomers = useCallback(async () => {
    // Step 1: Always load from local cache first
    await refreshStats();

    // Step 2: If online, background-refresh from server
    if (!navigator.onLine) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();
      if (!profile?.organization_id) return;

      // Cache org context every time we successfully fetch profile
      await cacheOfflineOrgContext(profile.organization_id, session.user.id);

      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, location, balance, organization_id, created_by')
        .eq('organization_id', profile.organization_id)
        .eq('created_by', session.user.id);

      if (error) throw error;

      const mapped: CachedCustomer[] = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        location: c.location,
        balance: Number(c.balance),
        organization_id: c.organization_id,
        created_by: c.created_by,
        isLocal: false,
        syncStatus: 'synced' as const,
        updated_at: Date.now(),
      }));

      await cacheCustomers(mapped);
      await refreshStats();
    } catch {
      console.warn('[DistributorOffline] Customers fetch failed, using cache');
    }
  }, [refreshStats]);

  // Fetch sales from server and cache locally (offline-first)
  // Also fetches sale_items so returns work offline
  const refreshSales = useCallback(async () => {
    // Step 1: Always load from local cache first
    await refreshStats();

    // Step 2: If online, background-refresh from server
    if (!navigator.onLine) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('sales')
        .select('id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, is_voided, created_at')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sale_items for all non-voided sales so returns work offline
      const nonVoidedIds = (data || []).filter(s => !s.is_voided).map(s => s.id);
      let itemsMap: Record<string, { product_id: string; product_name: string; quantity: number; unit_price: number; total_price: number }[]> = {};

      if (nonVoidedIds.length > 0) {
        // Fetch in chunks of 200 to avoid query limits
        for (let i = 0; i < nonVoidedIds.length; i += 200) {
          const chunk = nonVoidedIds.slice(i, i + 200);
          const { data: itemsData } = await supabase
            .from('sale_items')
            .select('sale_id, product_id, product_name, quantity, unit_price, total_price')
            .in('sale_id', chunk);
          
          for (const item of (itemsData || [])) {
            if (!itemsMap[item.sale_id]) itemsMap[item.sale_id] = [];
            itemsMap[item.sale_id].push({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: Number(item.unit_price),
              total_price: Number(item.total_price),
            });
          }
        }
      }

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
        items: itemsMap[s.id] || undefined,
      }));

      await cacheSales(mapped);
      await refreshStats();
    } catch {
      console.warn('[DistributorOffline] Sales fetch failed, using cache');
    }
  }, [refreshStats]);

  // Add customer offline with temp ID
  const addCustomerOffline = useCallback(async (
    name: string,
    phone: string,
    location: string,
    organizationId?: string,
    createdBy?: string
  ): Promise<CachedCustomer> => {
    const context = await resolveOfflineOrgContext();
    const resolvedOrgId = organizationId || context?.organizationId;
    const resolvedDistributorId = createdBy || context?.distributorId;

    if (!resolvedOrgId || !resolvedDistributorId) {
      throw new Error('Cannot add customer. Organization data not available.');
    }

    const tempId = `local_${generateUUID()}`;

    const customer: CachedCustomer = {
      id: tempId,
      name,
      phone,
      location,
      balance: 0,
      organization_id: resolvedOrgId,
      created_by: resolvedDistributorId,
      isLocal: true,
      syncStatus: 'pending',
      updated_at: Date.now(),
    };

    // Save to IndexedDB immediately
    await addLocalCustomer(customer);

    // Enqueue for sync
    await enqueueAction('ADD_CUSTOMER', {
      name,
      phone,
      location,
      organizationId: resolvedOrgId,
      createdBy: resolvedDistributorId,
      localId: tempId,
    });

    await refreshStats();

    // Try to sync immediately if online
    if (navigator.onLine) {
      setTimeout(syncAllPending, 500);
    }

    return customer;
  }, [refreshStats, resolveOfflineOrgContext]);

  // Queue an offline action and apply optimistic update
  const queueAction = useCallback(async (
    type: OfflineActionType,
    payload: any,
    inventoryUpdates?: { productId: string; quantityDelta: number }[],
    saleUpdate?: { saleId: string; paidDelta: number }
  ) => {
    // For CREATE_SALE: generate local sale ID and store locally
    if (type === 'CREATE_SALE') {
      const localSaleId = `local_${generateUUID()}`;
      payload = { ...payload, localSaleId };
      
      // Resolve customer name from local cache
      const customers = await getCachedCustomers();
      const customer = customers.find(c => c.id === payload.customerId);
      const customerName = customer?.name || 'غير معروف';
      
      const subtotal = (payload.items || []).reduce(
        (sum: number, item: any) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0
      );
      const discountValue = payload.discountValue || 0;
      const grandTotal = Math.max(0, subtotal - discountValue);
      
      // Add to local sales cache (optimistic)
      const localSale: CachedSale = {
        id: localSaleId,
        customer_id: payload.customerId,
        customerName,
        grandTotal,
        paidAmount: payload.paymentType === 'CASH' ? grandTotal : 0,
        remaining: payload.paymentType === 'CASH' ? 0 : grandTotal,
        paymentType: payload.paymentType || 'CASH',
        isVoided: false,
        timestamp: Date.now(),
        isLocal: true,
        items: (payload.items || []).map((item: any) => ({
          product_id: item.productId || item.product_id,
          product_name: item.productName || item.product_name,
          quantity: item.quantity,
          unit_price: item.unitPrice || item.unit_price,
          total_price: item.totalPrice || item.total_price || item.quantity * (item.unitPrice || item.unit_price),
        })),
      };
      await addLocalSale(localSale);
      
      // Add to local invoices cache (so it appears in history immediately)
      const cachedOrg = await getCachedOrgInfo();
      const localInvoice: CachedInvoice = {
        id: localSaleId,
        invoice_type: 'sale',
        invoice_number: `INV-${localSaleId.slice(-4).toUpperCase()}`,
        reference_id: localSaleId,
        customer_id: payload.customerId,
        customer_name: customerName,
        created_by: null,
        created_by_name: null,
        grand_total: grandTotal,
        paid_amount: payload.paymentType === 'CASH' ? grandTotal : 0,
        remaining: payload.paymentType === 'CASH' ? 0 : grandTotal,
        payment_type: payload.paymentType || 'CASH',
        items: (payload.items || []).map((item: any) => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice || item.quantity * item.unitPrice,
        })),
        notes: null,
        reason: null,
        org_name: cachedOrg?.orgName || null,
        legal_info: cachedOrg?.legalInfo || null,
        invoice_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        isLocal: true,
        discount_type: payload.discountType || null,
        discount_percentage: payload.discountPercentage || 0,
        discount_value: discountValue,
        subtotal: subtotal,
      };
      await addLocalInvoice(localInvoice);
    }
    
    // For ADD_COLLECTION with a local sale: add local invoice for history
    if (type === 'ADD_COLLECTION') {
      const sales = await getCachedSales();
      const sale = sales.find(s => s.id === payload.saleId);
      if (sale) {
        const localCollectionId = `local_${generateUUID()}`;
        const cachedOrg2 = await getCachedOrgInfo();
        const collectionInvoice: CachedInvoice = {
          id: localCollectionId,
          invoice_type: 'collection',
          invoice_number: `COL-${localCollectionId.slice(-4).toUpperCase()}`,
          reference_id: payload.saleId,
          customer_id: sale.customer_id,
          customer_name: sale.customerName,
          created_by: null,
          created_by_name: null,
          grand_total: payload.amount,
          paid_amount: payload.amount,
          remaining: 0,
          payment_type: 'CASH',
          items: [],
          notes: payload.notes || null,
          reason: null,
          org_name: cachedOrg2?.orgName || null,
          legal_info: cachedOrg2?.legalInfo || null,
          invoice_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          isLocal: true,
        };
        await addLocalInvoice(collectionInvoice);
      }
    }

    // For CREATE_RETURN: add local invoice for return history
    if (type === 'CREATE_RETURN') {
      const sales = await getCachedSales();
      const sale = sales.find(s => s.id === payload.saleId);
      const localReturnId = `local_${generateUUID()}`;
      const cachedOrg3 = await getCachedOrgInfo();
      const grandTotal = (payload.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity * item.unit_price), 0
      );
      const returnInvoice: CachedInvoice = {
        id: localReturnId,
        invoice_type: 'return',
        invoice_number: `RET-${localReturnId.slice(-4).toUpperCase()}`,
        reference_id: payload.saleId,
        customer_id: sale?.customer_id || null,
        customer_name: sale?.customerName || 'غير معروف',
        created_by: null,
        created_by_name: null,
        grand_total: grandTotal,
        paid_amount: 0,
        remaining: 0,
        payment_type: null,
        items: (payload.items || []).map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
        })),
        notes: null,
        reason: payload.reason || null,
        org_name: cachedOrg3?.orgName || null,
        legal_info: cachedOrg3?.legalInfo || null,
        invoice_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        isLocal: true,
      };
      await addLocalInvoice(returnInvoice);
    }
    
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
      await refreshCustomers();
    }
    return result;
  }, [refreshStats, refreshInventory, refreshSales, refreshCustomers]);

  // Initialize
  useEffect(() => {
    mountedRef.current = true;

    // Reusable function to fetch & cache org legal info (stamp, registrations)
    const refreshOrgLegalCache = async () => {
      if (!navigator.onLine) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
        if (!profile?.organization_id) return;
        const [orgRes, legalRes] = await Promise.all([
          supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
          supabase.from('organization_legal_info')
            .select('commercial_registration, industrial_registration, tax_identification, trademark_name, stamp_url')
            .eq('organization_id', profile.organization_id).maybeSingle()
        ]);
        if (orgRes.data) {
          await cacheOrgInfo(orgRes.data.name, legalRes.data || null, profile.organization_id, session.user.id);
        }
      } catch { /* non-critical */ }
    };

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      // Auto-refresh legal info cache when connectivity is restored
      refreshOrgLegalCache();
    };
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load persisted ID maps first, then start sync engine
    loadPersistedIdMaps().then(() => {
      startDistributorSync();
    });

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
          refreshCustomers();
        }
      } else if (event.type === 'error') {
        setState(prev => ({ ...prev, isSyncing: false }));
        refreshStats();
      }
    });

    // Load initial data — always loads from IndexedDB first (instant), then background refresh if online
    refreshStats();
    // Cache org context eagerly on init (ensures offline customer creation works)
    resolveOfflineOrgContext();
    refreshInventory();
    refreshSales();
    refreshCustomers();

    // Cache org name + legal info (stamp, registrations) eagerly at login/init
    refreshOrgLegalCache();

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
  }, [refreshStats, refreshInventory, refreshSales, refreshCustomers]);

  const retrySingleAction = useCallback(async (actionId: string) => {
    await retryFailedAction(actionId);
    await refreshStats();
    if (navigator.onLine) {
      triggerSync();
    }
  }, [refreshStats, triggerSync]);

  const retryAllFailed = useCallback(async () => {
    await retryAllFailedActions();
    await refreshStats();
    if (navigator.onLine) {
      triggerSync();
    }
  }, [refreshStats, triggerSync]);

  return {
    ...state,
    queueAction,
    triggerSync,
    refreshInventory,
    refreshStats,
    refreshCustomers,
    addCustomerOffline,
    retrySingleAction,
    retryAllFailed,
  };
}
