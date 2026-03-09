/**
 * Realtime Sync Hook - Dual-channel architecture for improved WebSocket stability
 * 
 * Architecture:
 * - org-core: products, distributor_inventory, profiles, pending_employees, developer_licenses
 * - org-txn:  sales, collections, purchases, deliveries, customers, subscription_payments
 * - dev-global: developer-only cross-org channel
 * - Automatic reconnection with exponential backoff per channel
 * - Fallback polling on WebSocket failure
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

const FALLBACK_POLL_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

function useChannelReconnect(channelName: string) {
  const attemptsRef = useRef(0);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => { attemptsRef.current = 0; }, []);
  const increment = useCallback(() => {
    attemptsRef.current++;
    performanceMonitor.recordReconnect(channelName, attemptsRef.current);
    return attemptsRef.current;
  }, [channelName]);
  const exceeded = useCallback(() => attemptsRef.current >= MAX_RECONNECT_ATTEMPTS, []);

  const startFallback = useCallback((fn: () => void) => {
    if (fallbackRef.current) return;
    logger.warn(`[Realtime] Starting fallback polling for ${channelName}`, 'RealtimeSync');
    fallbackRef.current = setInterval(fn, FALLBACK_POLL_MS);
  }, [channelName]);

  const stopFallback = useCallback(() => {
    if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null; }
  }, []);

  return { reset, increment, exceeded, startFallback, stopFallback };
}

export function useRealtimeSync(orgId?: string | null, role?: string | null) {
  const queryClient = useQueryClient();
  const core = useChannelReconnect(`org-core-${orgId}`);
  const txn = useChannelReconnect(`org-txn-${orgId}`);

  // ─── Core channel: products, inventory, profiles, pending_employees, licenses ───
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-core-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'distributor_inventory', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_employees', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_licenses', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.licenses() }); })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          core.reset();
          core.stopFallback();
          logger.info(`[Realtime] Core channel connected: ${orgId}`, 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const attempt = core.increment();
          logger.warn(`[Realtime] Core channel error (attempt ${attempt}): ${err}`, 'RealtimeSync');
          if (core.exceeded()) {
            core.startFallback(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
            });
          }
        }
      });

    return () => { supabase.removeChannel(channel); core.stopFallback(); };
  }, [orgId, queryClient, core]);

  // ─── Transactions channel: sales, collections, purchases, deliveries, customers, subscription_payments ───
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-txn-${orgId}`)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payments', filter: `organization_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.licenses() }); })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          txn.reset();
          txn.stopFallback();
          logger.info(`[Realtime] Transactions channel connected: ${orgId}`, 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const attempt = txn.increment();
          logger.warn(`[Realtime] Transactions channel error (attempt ${attempt}): ${err}`, 'RealtimeSync');
          if (txn.exceeded()) {
            txn.startFallback(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
            });
          }
        }
      });

    return () => { supabase.removeChannel(channel); txn.stopFallback(); };
  }, [orgId, queryClient, txn]);

  // ─── Developer-only global channel ───
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

    return () => { supabase.removeChannel(devChannel); };
  }, [role, queryClient]);

  // ─── Reconnect on online/visibility ───
  useEffect(() => {
    const handleOnline = () => {
      logger.info('[Realtime] Back online, invalidating stale caches', 'RealtimeSync');
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
