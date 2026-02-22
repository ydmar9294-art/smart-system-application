/**
 * Centralized Supabase Query & RPC Wrappers (Section 6)
 * - Consistent error handling across all queries
 * - Structured error responses
 * - Organization context enforcement (Section 1)
 * - Logging for debugging
 */
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { dataCircuitBreaker } from '@/lib/circuitBreaker';

// ============================================
// Error Types
// ============================================

export class QueryError extends Error {
  public readonly code: string;
  public readonly details: string | null;

  constructor(message: string, code: string = 'QUERY_ERROR', details: string | null = null) {
    super(message);
    this.name = 'QueryError';
    this.code = code;
    this.details = details;
  }
}

export class MissingOrgError extends QueryError {
  constructor() {
    super('سياق المنشأة مفقود — لا يمكن تنفيذ الاستعلام', 'MISSING_ORG');
  }
}

// ============================================
// Organization Context Guard (Section 1 & 2)
// ============================================

/**
 * Validates that organization context exists before executing a query.
 * Developer role bypasses this check since developers access cross-org data.
 */
export function requireOrgContext(
  orgId: string | null | undefined,
  role: UserRole | null | undefined
): asserts orgId is string {
  // Developers can bypass org context for cross-org admin access
  if (role === UserRole.DEVELOPER) return;

  if (!orgId) {
    throw new MissingOrgError();
  }
}

/**
 * Returns true if a query should be enabled based on org context.
 * Used in React Query `enabled` conditions.
 */
export function canExecuteQuery(
  orgId: string | null | undefined,
  role: UserRole | null | undefined
): boolean {
  if (role === UserRole.DEVELOPER) return true;
  return !!orgId;
}

// ============================================
// Safe Query Wrapper (Section 6)
// ============================================

interface SafeQueryOptions {
  /** Human-readable label for logging */
  label: string;
}

/**
 * Wraps a Supabase query with consistent error handling and logging.
 * Throws a structured QueryError on failure.
 */
export async function safeQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  options: SafeQueryOptions
): Promise<T> {
  return dataCircuitBreaker.execute(
    async () => {
      const { data, error } = await queryFn();
      if (error) {
        logger.error(`[safeQuery:${options.label}]`, error.message || error);
        throw new QueryError(
          error.message || 'حدث خطأ في الاستعلام',
          error.code || 'DB_ERROR',
          error.details || null
        );
      }
      return data as T;
    },
    () => {
      logger.warn(`[safeQuery:${options.label}] Circuit open, returning empty`, 'CircuitBreaker');
      return [] as unknown as T;
    }
  );
}

// ============================================
// Safe RPC Wrapper (Section 6)
// ============================================

/**
 * Wraps a Supabase RPC call with consistent error handling.
 * Validates inputs before calling the function.
 */
export async function safeRpc<T>(
  fnName: string,
  params: Record<string, any>,
  options?: { label?: string }
): Promise<T> {
  const label = options?.label || fnName;
  try {
    const { data, error } = await supabase.rpc(fnName as any, params as any);
    if (error) {
      logger.error(`[safeRpc:${label}]`, error.message || String(error));
      throw new QueryError(
        error.message || 'حدث خطأ في العملية',
        error.code || 'RPC_ERROR',
        error.details || null
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof QueryError) throw err;
    const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
    logger.error(`[safeRpc:${label}]`, msg);
    throw new QueryError(msg, 'UNKNOWN_ERROR');
  }
}

// ============================================
// Input Validation Helpers (Section 9)
// ============================================

/**
 * Pre-mutation validation: ensures numeric fields are valid positive numbers.
 */
export function validatePositiveNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || value <= 0) {
    throw new QueryError(`${fieldName} يجب أن يكون رقماً موجباً`, 'VALIDATION_ERROR');
  }
}

/**
 * Pre-mutation validation: ensures string is non-empty after trimming.
 */
export function validateRequiredString(value: string | undefined | null, fieldName: string): void {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new QueryError(`${fieldName} مطلوب`, 'VALIDATION_ERROR');
  }
}

/**
 * Pre-mutation validation: ensures UUID format.
 */
export function validateUUID(value: string, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new QueryError(`${fieldName} غير صالح`, 'VALIDATION_ERROR');
  }
}

/**
 * Pre-mutation validation: ensures array has at least one element.
 */
export function validateNonEmptyArray(arr: any[], fieldName: string): void {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new QueryError(`${fieldName} يجب أن يحتوي على عنصر واحد على الأقل`, 'VALIDATION_ERROR');
  }
}
