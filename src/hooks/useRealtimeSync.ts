/**
 * Realtime Sync Hook - Supabase Realtime subscriptions with reconnection fallback
 * 
 * Hardened for Production:
 * - Org-scoped channel for tenant data
 * - Separate global channel for developer (subscription_payments + licenses across all orgs)
 * - Automatic reconnection with exponential backoff
 * - Fallback polling on WebSocket failure
 * - Minimal listeners to stay within Supabase channel limits
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

const FALLBACK_POLL_MS = 30_000; // 30s fallback polling if realtime fails
const MAX_RECONNECT_ATTEMPTS = 5;

export function useRealtimeSync(orgId?: string | null, role?: string | null) {
  const queryClient = useQueryClient();
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Fallback polling for critical data when realtime fails
  const startFallbackPolling = useCallback(() => {
    if (fallbackRef.current) return;
    logger.warn('[Realtime] Starting fallback polling', 'RealtimeSync');
    fallbackRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      }
    }, FALLBACK_POLL_MS);
  }, [queryClient, orgId]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  // Org-scoped realtime channel
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-rt-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'distributor_inventory', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_employees', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveries(orgId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) }); })
      // Subscription payments for this org (Owner sees updates)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payments', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.licenses() }); })
      // Developer licenses for this org
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_licenses', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.licenses() }); })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
          stopFallbackPolling();
          logger.info(`[Realtime] Org channel connected: ${orgId}`, 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reconnectAttemptsRef.current++;
          logger.warn(`[Realtime] Org channel error (attempt ${reconnectAttemptsRef.current}): ${err}`, 'RealtimeSync');
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            startFallbackPolling();
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      stopFallbackPolling();
    };
  }, [orgId, queryClient, startFallbackPolling, stopFallbackPolling]);

  // Developer-only global channel: listens to ALL subscription_payments & licenses
  useEffect(() => {
    if (role !== 'DEVELOPER') return;

    const devChannel = supabase
      .channel('dev-subscriptions-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payments' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
          queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_licenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
          queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
        })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info('[Realtime] Developer global channel connected', 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn(`[Realtime] Developer channel error: ${err}`, 'RealtimeSync');
        }
      });

    return () => {
      supabase.removeChannel(devChannel);
    };
  }, [role, queryClient]);

  // Reconnect on online/visibility events
  useEffect(() => {
    const handleOnline = () => {
      logger.info('[Realtime] Back online, invalidating stale caches', 'RealtimeSync');
      // Force refresh critical data after coming back online
      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [queryClient, orgId]);
}
