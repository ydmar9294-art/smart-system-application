/**
 * Realtime Sync Hook - Dual-channel architecture for improved WebSocket stability
 * 
 * Architecture:
 * - org-core: products, distributor_inventory, profiles, pending_employees, developer_licenses
 * - org-txn:  sales, collections, purchases, deliveries, customers, subscription_payments
 * - dev-global: developer-only cross-org channel
 * - Automatic reconnection with exponential backoff per channel
 * - Fallback polling on WebSocket failure
 * - Stabilized refs to prevent unnecessary resubscriptions
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

const FALLBACK_POLL_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface ChannelReconnectState {
  attempts: number;
  fallbackInterval: ReturnType<typeof setInterval> | null;
}

export function useRealtimeSync(orgId?: string | null, role?: string | null) {
  const queryClient = useQueryClient();
  
  // Stabilize refs to prevent unnecessary effect reruns
  const orgIdRef = useRef(orgId);
  const roleRef = useRef(role);
  orgIdRef.current = orgId;
  roleRef.current = role;

  // Channel reconnect state stored in refs (no re-renders)
  const coreStateRef = useRef<ChannelReconnectState>({ attempts: 0, fallbackInterval: null });
  const txnStateRef = useRef<ChannelReconnectState>({ attempts: 0, fallbackInterval: null });

  const stopFallback = useCallback((stateRef: React.MutableRefObject<ChannelReconnectState>) => {
    if (stateRef.current.fallbackInterval) {
      clearInterval(stateRef.current.fallbackInterval);
      stateRef.current.fallbackInterval = null;
    }
  }, []);

  const startFallback = useCallback((
    stateRef: React.MutableRefObject<ChannelReconnectState>,
    channelName: string,
    fn: () => void
  ) => {
    if (stateRef.current.fallbackInterval) return;
    logger.warn(`[Realtime] Starting fallback polling for ${channelName}`, 'RealtimeSync');
    stateRef.current.fallbackInterval = setInterval(fn, FALLBACK_POLL_MS);
  }, []);

  // ─── Core channel: products, inventory, profiles, pending_employees, licenses ───
  useEffect(() => {
    if (!orgId) return;

    const state = coreStateRef;

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
          state.current.attempts = 0;
          stopFallback(state);
          logger.info(`[Realtime] Core channel connected: ${orgId}`, 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          state.current.attempts++;
          performanceMonitor.recordReconnect(`org-core-${orgId}`, state.current.attempts);
          logger.warn(`[Realtime] Core channel error (attempt ${state.current.attempts}): ${err}`, 'RealtimeSync');
          if (state.current.attempts >= MAX_RECONNECT_ATTEMPTS) {
            startFallback(state, `org-core-${orgId}`, () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
            });
          }
        }
      });

    return () => { supabase.removeChannel(channel); stopFallback(state); };
  }, [orgId, queryClient, stopFallback, startFallback]);

  // ─── Transactions channel: sales, collections, purchases, deliveries, customers, subscription_payments ───
  useEffect(() => {
    if (!orgId) return;

    const state = txnStateRef;

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
          state.current.attempts = 0;
          stopFallback(state);
          logger.info(`[Realtime] Transactions channel connected: ${orgId}`, 'RealtimeSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          state.current.attempts++;
          performanceMonitor.recordReconnect(`org-txn-${orgId}`, state.current.attempts);
          logger.warn(`[Realtime] Transactions channel error (attempt ${state.current.attempts}): ${err}`, 'RealtimeSync');
          if (state.current.attempts >= MAX_RECONNECT_ATTEMPTS) {
            startFallback(state, `org-txn-${orgId}`, () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
            });
          }
        }
      });

    return () => { supabase.removeChannel(channel); stopFallback(state); };
  }, [orgId, queryClient, stopFallback, startFallback]);

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
      const currentOrgId = orgIdRef.current;
      if (currentOrgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products(currentOrgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sales(currentOrgId) });
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
  }, [queryClient]);
}
