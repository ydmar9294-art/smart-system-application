/**
 * useEntityList — generic hook for paginated, searchable entity lists.
 * 
 * Backward-compatible: existing custom hooks (useProducts, useCustomers, ...)
 * continue to work unchanged. New screens may opt-in to this hook for less code.
 */
import { useMemo, useState, useCallback } from 'react';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export interface EntityListConfig<T> {
  queryKey: readonly unknown[];
  fetcher: () => Promise<T[]>;
  /** Function returning a string used for client-side text search. */
  searchKey?: (item: T) => string;
  /** Page size for client-side pagination. Default 50. */
  pageSize?: number;
  /** Optional react-query options override. */
  queryOptions?: Omit<UseQueryOptions<T[], Error, T[], readonly unknown[]>, 'queryKey' | 'queryFn'>;
}

export interface EntityListResult<T> {
  items: T[];
  filteredItems: T[];
  pagedItems: T[];
  isLoading: boolean;
  error: Error | null;
  search: string;
  setSearch: (q: string) => void;
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  refetch: () => void;
}

export function useEntityList<T>({
  queryKey,
  fetcher,
  searchKey,
  pageSize = 50,
  queryOptions,
}: EntityListConfig<T>): EntityListResult<T> {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } = useQuery<T[], Error>({
    queryKey,
    queryFn: fetcher,
    ...queryOptions,
  });

  const items = data ?? [];

  const filteredItems = useMemo(() => {
    if (!search.trim() || !searchKey) return items;
    const q = search.trim().toLowerCase();
    return items.filter(item => searchKey(item).toLowerCase().includes(q));
  }, [items, search, searchKey]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const pagedItems = useMemo(
    () => filteredItems.slice(page * pageSize, (page + 1) * pageSize),
    [filteredItems, page, pageSize],
  );

  const wrappedRefetch = useCallback(() => { refetch(); }, [refetch]);

  return {
    items,
    filteredItems,
    pagedItems,
    isLoading,
    error: error ?? null,
    search,
    setSearch,
    page,
    setPage,
    pageCount,
    refetch: wrappedRefetch,
  };
}
