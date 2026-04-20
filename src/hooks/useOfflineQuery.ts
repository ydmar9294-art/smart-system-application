/**
 * useOfflineQuery - Offline-first wrapper for React Query
 * 
 * Extends useQuery with IndexedDB persistence:
 * 1. On mount: seeds React Query cache from IndexedDB (instant offline read)
 * 2. On fetch success: persists fresh data to IndexedDB
 * 3. When offline: serves cached data seamlessly
 * 
 * This makes ALL dashboards (Owner, Accountant, SalesManager, Warehouse)
 * work offline-first without any dashboard code changes.
 */

import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getCachedQueryData, setCachedQueryData } from '@/lib/offlineCache';
import { queryClient } from '@/lib/queryClient';

interface OfflineQueryOptions<T> extends Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  /** TTL for IndexedDB cache in ms. Default: 24 hours */
  offlineTtlMs?: number;
  /** Skip offline caching for this query */
  skipOfflineCache?: boolean;
}

export function useOfflineQuery<T>(options: OfflineQueryOptions<T>) {
  const {
    queryKey,
    queryFn,
    offlineTtlMs,
    skipOfflineCache = false,
    ...restOptions
  } = options;

  const lastSeededKeyRef = useRef<string | null>(null);
  const queryKeyStr = JSON.stringify(queryKey);

  // Seed React Query from IndexedDB on first mount or when queryKey changes
  useEffect(() => {
    if (skipOfflineCache || lastSeededKeyRef.current === queryKeyStr) return;
    lastSeededKeyRef.current = queryKeyStr;

    getCachedQueryData<T>(queryKey as readonly unknown[]).then((cached) => {
      if (cached != null) {
        // Pre-populate React Query cache so UI renders instantly
        const existing = queryClient.getQueryData(queryKey);
        if (existing == null) {
          queryClient.setQueryData(queryKey, cached);
        }
      }
    }).catch(() => {
      // IndexedDB not available
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKeyStr, skipOfflineCache]);

  const result = useQuery<T, Error, T, QueryKey>({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();

      // Persist successful fetch to IndexedDB (background, non-blocking)
      if (!skipOfflineCache && data != null) {
        setCachedQueryData(queryKey as readonly unknown[], data, offlineTtlMs).catch(() => {});
      }

      return data;
    },
    ...restOptions,
  });

  return result;
}
