/**
 * Customer Mutations Hook
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { customerService } from '@/services/customerService';
import { Customer } from '@/types';
import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { QueryError } from '@/lib/safeQuery';
import { extractErrorMessage } from '@/lib/errorHandler';

export function useCustomerMutations(orgId?: string | null, onSuccess?: (msg: string) => void, onError?: (msg: string) => void) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    console.error('[Customer Error]:', err);
    onError?.(extractErrorMessage(err));
    throw err;
  }, [onError]);

  const addCustomer = useCallback(async (name: string, phone: string, location?: string) => {
    try {
      if (!orgId) throw new QueryError('لا توجد منشأة', 'MISSING_ORG');

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new QueryError('غير مسجل الدخول', 'AUTH_REQUIRED');

      const custKey = queryKeys.customers(orgId);
      const tempId = generateUUID();
      const optimistic: Customer = {
        id: tempId, name, phone, balance: 0, location,
        organization_id: orgId, created_by: currentUser.id,
      };
      queryClient.setQueryData<Customer[]>(custKey, old => [optimistic, ...(old || [])]);

      try {
        await customerService.addCustomer(name, phone, orgId, currentUser.id, location);
      } catch (err) {
        queryClient.setQueryData<Customer[]>(custKey, old => (old || []).filter(c => c.id !== tempId));
        throw err;
      }

      onSuccess?.('تم إضافة الزبون بنجاح');
      queryClient.invalidateQueries({ queryKey: custKey });
    } catch (e) { handleError(e); }
  }, [orgId, queryClient, onSuccess, handleError]);

  return { addCustomer };
}
