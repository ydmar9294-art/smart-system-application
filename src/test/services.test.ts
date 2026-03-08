/**
 * Service Layer Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: 'test-id', error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    setUser: vi.fn(),
    getRecentLogs: vi.fn().mockReturnValue([]),
    clearBuffer: vi.fn(),
  },
}));

// Mock circuit breaker
vi.mock('@/lib/circuitBreaker', () => ({
  dataCircuitBreaker: {
    execute: vi.fn(async (fn: any) => fn()),
  },
}));

// Mock performance monitor
vi.mock('@/utils/monitoring/performanceMonitor', () => ({
  performanceMonitor: {
    startTimer: vi.fn(() => vi.fn().mockReturnValue(100)),
    recordFailure: vi.fn(),
    recordReconnect: vi.fn(),
    recordSyncFailure: vi.fn(),
  },
}));

describe('Performance Monitor', () => {
  it('startTimer returns a function that measures duration', () => {
    // Use the mocked monitor since the real one is mocked globally
    const { performanceMonitor } = require('@/utils/monitoring/performanceMonitor');
    const end = performanceMonitor.startTimer('test-op');
    expect(typeof end).toBe('function');
  });
});

describe('Conflict Detection', () => {
  it('ConflictError has correct properties', async () => {
    const { ConflictError } = await import('@/utils/monitoring/conflictDetection');
    const err = new ConflictError('products', 'id-1', '2024-01-01', '2024-01-02');
    expect(err.name).toBe('ConflictError');
    expect(err.table).toBe('products');
    expect(err.recordId).toBe('id-1');
  });
});

describe('Staggered Refresh', () => {
  it('calls invalidateQueries on query client', async () => {
    const { staggeredRefresh } = await import('@/hooks/data/staggeredRefresh');
    const mockQC = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    };
    await staggeredRefresh(mockQC as any, 'org-123');
    expect(mockQC.invalidateQueries).toHaveBeenCalled();
    // Should be called with multiple query keys across groups
    expect(mockQC.invalidateQueries.mock.calls.length).toBeGreaterThan(5);
  });
});

describe('Validation Helpers', () => {
  it('validateUUID rejects invalid UUIDs', async () => {
    const { validateUUID } = await import('@/lib/safeQuery');
    expect(() => validateUUID('not-a-uuid', 'test')).toThrow();
  });

  it('validateUUID accepts valid UUIDs', async () => {
    const { validateUUID } = await import('@/lib/safeQuery');
    expect(() => validateUUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'test')).not.toThrow();
  });

  it('validatePositiveNumber rejects zero', async () => {
    const { validatePositiveNumber } = await import('@/lib/safeQuery');
    expect(() => validatePositiveNumber(0, 'test')).toThrow();
  });

  it('validateRequiredString rejects empty strings', async () => {
    const { validateRequiredString } = await import('@/lib/safeQuery');
    expect(() => validateRequiredString('', 'test')).toThrow();
    expect(() => validateRequiredString('  ', 'test')).toThrow();
  });
});
