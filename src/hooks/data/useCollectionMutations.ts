/**
 * Collection Mutations Hook
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { collectionService } from '@/services/collectionService';
import { Sale } from '@/types';
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
      // Optimistic update
      const salesKey = queryKeys.sales(orgId);
      const previousSales = queryClient.getQueryData<Sale[]>(salesKey);
      if (previousSales) {
        queryClient.setQueryData<Sale[]>(salesKey, old =>
          (old || []).map(sale =>
            sale.id === saleId
              ? { ...sale, paidAmount: sale.paidAmount + amount, remaining: sale.remaining - amount }
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
    try {
      await collectionService.reversePayment(paymentId, reason);
      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  return { addCollection, reversePayment };
}
