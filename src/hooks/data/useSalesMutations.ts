/**
 * Sales Mutations Hook
 * Extracted from DataContext for separation of concerns
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { salesService } from '@/services/salesService';
import { collectionService } from '@/services/collectionService';
import { Sale } from '@/types';
import { extractErrorMessage } from '@/lib/errorHandler';

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
      await salesService.createSale({ customerId, items });
      invalidateSalesDeps();
    } catch (e) { handleError(e); }
  }, [invalidateSalesDeps, handleError]);

  const submitInvoice = useCallback(async (d: any) => {
    try {
      await salesService.createSale({
        customerId: d.customerId, items: d.items, paymentType: d.paymentType,
        discountType: d.discountType, discountValue: d.discountValue,
        discountPercentage: d.discountPercentage,
      });
      invalidateSalesDeps();
    } catch (e) { handleError(e); }
  }, [invalidateSalesDeps, handleError]);

  const submitPayment = useCallback(async (d: any) => {
    try {
      await collectionService.addCollection(d.saleId, d.amount);
      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const voidSale = useCallback(async (saleId: string, reason: string) => {
    try {
      await salesService.voidSale({ saleId, reason });
      invalidateSalesDeps();
    } catch (e) { handleError(e); }
  }, [invalidateSalesDeps, handleError]);

  return { createSale, submitInvoice, submitPayment, voidSale };
}
