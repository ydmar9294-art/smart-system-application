/**
 * Product Mutations Hook
 * Now with conflict detection before updates
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { productService } from '@/services/productService';
import { Product } from '@/types';
import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { QueryError } from '@/lib/safeQuery';
import { extractErrorMessage } from '@/lib/errorHandler';
import { checkConflict } from '@/utils/monitoring/conflictDetection';

export function useProductMutations(orgId?: string | null, onSuccess?: (msg: string) => void, onError?: (msg: string) => void) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    console.error('[Product Error]:', err);
    onError?.(extractErrorMessage(err));
    throw err;
  }, [onError]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'organization_id'>) => {
    try {
      if (!orgId) throw new QueryError('لا توجد منشأة', 'MISSING_ORG');

      const prodKey = queryKeys.products(orgId);
      const tempId = generateUUID();
      const optimistic: Product = { id: tempId, organization_id: orgId, ...product };
      queryClient.setQueryData<Product[]>(prodKey, old => [optimistic, ...(old || [])]);

      try {
        await productService.addProduct(product, orgId);
      } catch (err) {
        queryClient.setQueryData<Product[]>(prodKey, old => (old || []).filter(p => p.id !== tempId));
        throw err;
      }

      onSuccess?.('تم إضافة المنتج بنجاح');
      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [orgId, queryClient, onSuccess, handleError]);

  const updateProduct = useCallback(async (product: Product) => {
    try {
      const prodKey = queryKeys.products(orgId);
      const previousProducts = queryClient.getQueryData<Product[]>(prodKey);
      const oldProduct = previousProducts?.find(p => p.id === product.id);

      // Conflict detection: check if product was modified by another user
      if (oldProduct) {
        try {
          await checkConflict('products', product.id, new Date().toISOString());
        } catch (conflictErr: any) {
          if (conflictErr?.name === 'ConflictError') {
            onError?.('تعارض بيانات: تم تعديل المنتج بواسطة مستخدم آخر. يرجى تحديث الصفحة والمحاولة مجدداً');
            queryClient.invalidateQueries({ queryKey: prodKey });
            return;
          }
        }
      }

      queryClient.setQueryData<Product[]>(prodKey, old =>
        (old || []).map(p => p.id === product.id ? product : p)
      );

      try {
        await productService.updateProduct(product);

        // Log price changes
        if (oldProduct && orgId) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUser?.id || '').maybeSingle();
          const changerName = profile?.full_name || 'مستخدم';
          if (currentUser) {
            await productService.logPriceChanges(oldProduct, product, orgId, currentUser.id, changerName);
          }
        }
      } catch (err) {
        if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, onError, handleError]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const prodKey = queryKeys.products(orgId);
      const previousProducts = queryClient.getQueryData<Product[]>(prodKey);
      queryClient.setQueryData<Product[]>(prodKey, old => (old || []).filter(p => p.id !== id));

      try {
        await productService.deleteProduct(id);
      } catch (err) {
        if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  return { addProduct, updateProduct, deleteProduct };
}
