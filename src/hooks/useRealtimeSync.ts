/**
 * Realtime Sync Hook - Replaces polling with Supabase Realtime subscriptions
 * 
 * Performance Impact: Eliminates ~2,500 req/s at 25K users
 * Instead of 10s polling intervals, we subscribe to postgres_changes events
 * and invalidate React Query cache only when data actually changes.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryClient';

export function useRealtimeSync(orgId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-realtime-${orgId}`)
      // Distributor inventory changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'distributor_inventory',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
        }
      )
      // Profile changes (employee activation/deactivation)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
        }
      )
      // Pending employees changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_employees',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) });
        }
      )
      // Products changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
        }
      )
      // Sales changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
        }
      )
      // Collections changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
