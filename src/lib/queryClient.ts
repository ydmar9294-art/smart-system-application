/**
 * React Query Client Configuration
 * Optimized for High-Load SaaS (500+ concurrent users)
 * 
 * - Longer staleTime to reduce DB hits
 * - Retry with backoff for resilience
 * - Deduplication built-in via React Query
 * - Window focus refetch disabled for mobile stability
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — reduce DB pressure
      gcTime: 20 * 60 * 1000,         // 20 min — longer cache retention
      refetchOnWindowFocus: false,     // Prevent refetch storms
      retry: 2,                        // Retry twice on failure
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff
      refetchOnReconnect: 'always',
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query key factory - centralized key management
 */
export const queryKeys = {
  products: (orgId?: string | null) => ['products', orgId] as const,
  customers: (orgId?: string | null) => ['customers', orgId] as const,
  sales: (orgId?: string | null) => ['sales', orgId] as const,
  payments: (orgId?: string | null) => ['payments', orgId] as const,
  purchases: (orgId?: string | null) => ['purchases', orgId] as const,
  deliveries: (orgId?: string | null) => ['deliveries', orgId] as const,
  pendingEmployees: (orgId?: string | null) => ['pendingEmployees', orgId] as const,
  distributorInventory: (orgId?: string | null) => ['distributorInventory', orgId] as const,
  users: (orgId?: string | null) => ['users', orgId] as const,
  purchaseReturns: (orgId?: string | null) => ['purchaseReturns', orgId] as const,
  licenses: () => ['licenses'] as const,
  orgStats: () => ['orgStats'] as const,
} as const;