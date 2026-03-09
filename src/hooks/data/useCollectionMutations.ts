/**
 * Collection Mutations Hook — with optimistic UI & rollback
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { collectionService } from '@/services/collectionService';
import { Sale, Payment } from '@/types';
import { extractErrorMessage } from '@/lib/errorHandler';

export function useCollectionMutations(orgId?: string | null, onError?: (msg: string) => void) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    console.error('[Collection Error]:', err);
    onError?.(extractErrorMessage(err));
    throw err;
  }, [onError]);

  const addCollection = useCallback(async (saleId: string, amount: number, notes?: string) => {
    try {
      // Optimistic update on sales
      const salesKey = queryKeys.sales(orgId);
      const previousSales = queryClient.getQueryData<Sale[]>(salesKey);
      if (previousSales) {
        queryClient.setQueryData<Sale[]>(salesKey, old =>
          (old || []).map(sale =>
            sale.id === saleId
              ? { ...sale, paidAmount: sale.paidAmount + amount, remaining: Math.max(0, sale.remaining - amount) }
              : sale
          )
        );
      }

      try {
        await collectionService.addCollection(saleId, amount, notes);
      } catch (err) {
        if (previousSales) queryClient.setQueryData(salesKey, previousSales);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: salesKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const reversePayment = useCallback(async (paymentId: string, reason: string) => {
    // Optimistic: mark payment as reversed in cache
    const paymentsKey = queryKeys.payments(orgId);
    const previousPayments = queryClient.getQueryData<Payment[]>(paymentsKey);

    if (previousPayments) {
      queryClient.setQueryData<Payment[]>(paymentsKey, old =>
        (old || []).map(p =>
          p.id === paymentId ? { ...p, isReversed: true, reverseReason: reason } : p
        )
      );
    }

    try {
      await collectionService.reversePayment(paymentId, reason);
    } catch (err) {
      if (previousPayments) queryClient.setQueryData(paymentsKey, previousPayments);
      handleError(err);
      return;
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
    queryClient.invalidateQueries({ queryKey: paymentsKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
  }, [queryClient, orgId, handleError]);

  return { addCollection, reversePayment };
}
