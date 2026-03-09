/**
 * Tab Prefetch Hook
 * Prefetches adjacent tab data during idle time for instant tab switching.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { safeQuery } from '@/lib/safeQuery';
import { UserRole } from '@/types';
import {
  transformCustomer, transformPayment, transformPurchase, transformSale
} from '@/hooks/useDataOperations';

const PREFETCH_STALE = 3 * 60 * 1000; // 3 min

/**
 * Adjacency map: when user views tab X, prefetch tabs Y and Z.
 */
const ADJACENCY: Record<string, string[]> = {
  sales:       ['payments', 'customers'],
  collections: ['sales', 'customers'],
  purchases:   ['products'],
  debts:       ['customers', 'payments'],
  customers:   ['payments', 'sales'],
  daily:       ['sales', 'payments', 'customers'],
  'new-sale':  ['customers', 'products'],
  inventory:   ['products'],
  history:     ['sales', 'payments'],
};

export function useTabPrefetch(
  activeTab: string,
  orgId?: string | null,
  role?: UserRole | null
) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(new Set<string>());

  const prefetchDomain = useCallback(async (domain: string) => {
    if (!orgId || !role) return;
    if (prefetchedRef.current.has(domain)) return;
    prefetchedRef.current.add(domain);

    const isDev = role === UserRole.DEVELOPER;
    const addOrgFilter = (q: any) => (!isDev && orgId ? q.eq('organization_id', orgId) : q);

    try {
      switch (domain) {
        case 'payments':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.payments(orgId),
            staleTime: PREFETCH_STALE,
            queryFn: async () => {
              const data = await safeQuery(
                () => addOrgFilter(
                  supabase.from('collections')
                    .select('id,sale_id,amount,notes,is_reversed,reverse_reason,created_at,organization_id,collected_by')
                    .order('created_at', { ascending: false })
                    .range(0, 999)
                ),
                { label: 'prefetch_payments' }
              );
              return (data || []).map(transformPayment);
            },
          });
          break;

        case 'customers':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.customers(orgId),
            staleTime: PREFETCH_STALE,
            queryFn: async () => {
              const data = await safeQuery(
                () => addOrgFilter(
                  supabase.from('customers')
                    .select('id,name,phone,balance,organization_id,created_at,created_by,location')
                    .order('created_at', { ascending: false })
                    .range(0, 999)
                ),
                { label: 'prefetch_customers' }
              );
              return (data || []).map(transformCustomer);
            },
          });
          break;

        case 'sales':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.sales(orgId),
            staleTime: PREFETCH_STALE,
            queryFn: async () => {
              const data = await safeQuery(
                () => addOrgFilter(
                  supabase.from('sales')
                    .select('id,customer_id,customer_name,grand_total,paid_amount,remaining,payment_type,is_voided,void_reason,created_at,organization_id,created_by,discount_type,discount_value,discount_percentage')
                    .order('created_at', { ascending: false })
                    .range(0, 999)
                ),
                { label: 'prefetch_sales' }
              );
              return (data || []).map(transformSale);
            },
          });
          break;

        case 'purchases':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.purchases(orgId),
            staleTime: PREFETCH_STALE,
            queryFn: async () => {
              const data = await safeQuery(
                () => addOrgFilter(
                  supabase.from('purchases')
                    .select('id,product_id,product_name,quantity,unit_price,total_price,supplier_name,notes,created_at,organization_id')
                    .order('created_at', { ascending: false })
                    .range(0, 999)
                ),
                { label: 'prefetch_purchases' }
              );
              return (data || []).map(transformPurchase);
            },
          });
          break;

        case 'products':
          // Products are typically already loaded; just ensure warm cache
          await queryClient.prefetchQuery({
            queryKey: queryKeys.products(orgId),
            staleTime: PREFETCH_STALE,
          });
          break;
      }
    } catch {
      // Prefetch failures are non-critical
    }
  }, [orgId, role, queryClient]);

  useEffect(() => {
    const adjacent = ADJACENCY[activeTab];
    if (!adjacent || !orgId) return;

    // Use requestIdleCallback for non-blocking prefetch
    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    const cancel = typeof cancelIdleCallback !== 'undefined'
      ? cancelIdleCallback
      : clearTimeout;

    const ids = adjacent.map(domain => schedule(() => prefetchDomain(domain)));

    return () => ids.forEach(id => cancel(id));
  }, [activeTab, orgId, prefetchDomain]);

  // Reset prefetched set when org changes
  useEffect(() => {
    prefetchedRef.current.clear();
  }, [orgId]);
}
