/**
 * Cursor-based pagination hook for Supabase queries
 * Works with React Query's infinite query pattern
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { canExecuteQuery, requireOrgContext } from '@/lib/safeQuery';
import { UserRole } from '@/types';

interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

interface UseCursorPaginationOptions<T> {
  queryKey: readonly unknown[];
  fetchFn: (cursor?: string, limit?: number) => Promise<PaginatedResult<T>>;
  orgId?: string | null;
  role?: UserRole | null;
  enabled?: boolean;
  staleTime?: number;
  pageSize?: number;
}

/**
 * Generic cursor-based pagination hook.
 * Returns flat data array + fetchNextPage for infinite scroll.
 */
export function useCursorPagination<T>({
  queryKey,
  fetchFn,
  orgId,
  role,
  enabled = true,
  staleTime = 5 * 60 * 1000,
  pageSize = 50,
}: UseCursorPaginationOptions<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      requireOrgContext(orgId, role);
      return fetchFn(pageParam as string | undefined, pageSize);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && canExecuteQuery(orgId, role),
    staleTime,
  });

  // Flatten pages into single array for backward compatibility
  const flatData = query.data?.pages.flatMap(p => p.data) ?? [];

  return {
    ...query,
    data: flatData,
    /** Total items loaded so far */
    totalLoaded: flatData.length,
  };
}
