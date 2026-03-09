/**
 * Sales Mutations Hook — with optimistic UI updates & offline queue
 */
import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { salesService } from '@/services/salesService';
import { collectionService } from '@/services/collectionService';
import { Sale, Payment } from '@/types';
import { generateUUID } from '@/lib/uuid';
import { extractErrorMessage } from '@/lib/errorHandler';
import { withOfflineQueue, processQueue } from './useOfflineMutationQueue';

// Register service functions for offline replay
const offlineCreateSale = withOfflineQueue('salesService.createSale', (args: any) =>
  salesService.createSale(args)
);
const offlineAddCollection = withOfflineQueue('collectionService.addCollection', (saleId: string, amount: number, notes?: string) =>
  collectionService.addCollection(saleId, amount, notes)
);
const offlineVoidSale = withOfflineQueue('salesService.voidSale', (args: any) =>
  salesService.voidSale(args)
);

export function useSalesMutations(orgId?: string | null, onError?: (msg: string) => void) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    console.error('[Sales Error]:', err);
    onError?.(extractErrorMessage(err));
    throw err;
  }, [onError]);

  const invalidateSalesDeps = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
  }, [queryClient, orgId]);

  const createSale = useCallback(async (customerId: string, items: any[]) => {
    try {
      await offlineCreateSale({ customerId, items });
      invalidateSalesDeps();
    } catch (e) { handleError(e); }
  }, [invalidateSalesDeps, handleError]);

  const submitInvoice = useCallback(async (d: any) => {
    // Optimistic: add a temporary sale to the cache
    const salesKey = queryKeys.sales(orgId);
    const previousSales = queryClient.getQueryData<Sale[]>(salesKey);
    const tempId = `temp-${generateUUID()}`;

    const grandTotal = (d.items || []).reduce((s: number, it: any) => s + (it.totalPrice || it.quantity * it.unitPrice), 0) - (d.discountValue || 0);
    const optimisticSale: Sale = {
      id: tempId,
      organization_id: orgId || undefined,
      customer_id: d.customerId,
      customerName: d.customerName || '',
      grandTotal: Math.max(0, grandTotal),
      paidAmount: d.paymentType === 'CASH' ? Math.max(0, grandTotal) : 0,
      remaining: d.paymentType === 'CASH' ? 0 : Math.max(0, grandTotal),
      paymentType: d.paymentType || 'CASH',
      isVoided: false,
      timestamp: Date.now(),
      items: (d.items || []).map((it: any) => ({
        id: generateUUID(), productId: it.productId, productName: it.productName,
        quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.totalPrice || it.quantity * it.unitPrice,
      })),
      createdBy: undefined,
      discountType: d.discountType,
      discountValue: d.discountValue,
      discountPercentage: d.discountPercentage,
    };

    queryClient.setQueryData<Sale[]>(salesKey, old => [optimisticSale, ...(old || [])]);

    try {
      await offlineCreateSale({
        customerId: d.customerId, items: d.items, paymentType: d.paymentType,
        discountType: d.discountType, discountValue: d.discountValue,
        discountPercentage: d.discountPercentage,
      });
    } catch (err) {
      // Rollback
      if (previousSales) queryClient.setQueryData(salesKey, previousSales);
      else queryClient.setQueryData<Sale[]>(salesKey, old => (old || []).filter(s => s.id !== tempId));
      handleError(err);
      return;
    }

    invalidateSalesDeps();
  }, [queryClient, orgId, invalidateSalesDeps, handleError]);

  const submitPayment = useCallback(async (d: any) => {
    // Optimistic: update the sale's paid/remaining
    const salesKey = queryKeys.sales(orgId);
    const previousSales = queryClient.getQueryData<Sale[]>(salesKey);

    if (previousSales) {
      queryClient.setQueryData<Sale[]>(salesKey, old =>
        (old || []).map(sale =>
          sale.id === d.saleId
            ? { ...sale, paidAmount: sale.paidAmount + d.amount, remaining: Math.max(0, sale.remaining - d.amount) }
            : sale
        )
      );
    }

    try {
      await offlineAddCollection(d.saleId, d.amount);
    } catch (err) {
      if (previousSales) queryClient.setQueryData(salesKey, previousSales);
      handleError(err);
      return;
    }

    queryClient.invalidateQueries({ queryKey: salesKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
  }, [queryClient, orgId, handleError]);

  const voidSale = useCallback(async (saleId: string, reason: string) => {
    // Optimistic: mark sale as voided
    const salesKey = queryKeys.sales(orgId);
    const previousSales = queryClient.getQueryData<Sale[]>(salesKey);

    queryClient.setQueryData<Sale[]>(salesKey, old =>
      (old || []).map(sale =>
        sale.id === saleId ? { ...sale, isVoided: true, voidReason: reason } : sale
      )
    );

    try {
      await offlineVoidSale({ saleId, reason });
    } catch (err) {
      if (previousSales) queryClient.setQueryData(salesKey, previousSales);
      handleError(err);
      return;
    }

    invalidateSalesDeps();
  }, [queryClient, orgId, invalidateSalesDeps, handleError]);

  return { createSale, submitInvoice, submitPayment, voidSale };
}
