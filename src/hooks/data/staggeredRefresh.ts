/**
 * Staggered Refresh Utility
 * Batched invalidation with delays to prevent network bursts
 */
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Invalidate queries in staggered groups to avoid request spikes.
 * Uses Promise.allSettled so one failure doesn't block others.
 */
export async function staggeredRefresh(queryClient: QueryClient, orgId?: string | null): Promise<void> {
  // Group 1: Core inventory
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns(orgId) }),
  ]);

  await delay(150);

  // Group 2: Customers & users
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) }),
  ]);

  await delay(150);

  // Group 3: Transactions
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) }),
  ]);

  await delay(200);

  // Group 4: Analytics & secondary
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.licenses() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() }),
  ]);
}
