/**
 * BaseService — abstract base class for all data services.
 * 
 * Purpose: standardize error handling, logging, and org-context validation
 * across the service layer without breaking existing service signatures.
 * 
 * Backward compatibility: existing services keep their public API unchanged.
 * They can OPTIONALLY extend this class to gain consistent helpers.
 */
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export class ServiceError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'SERVICE_ERROR', details?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }
}

export abstract class BaseService {
  /** Service name used for log scoping. Subclasses override. */
  protected abstract readonly serviceName: string;

  /**
   * Standardized error handler. Logs structured error and rethrows a ServiceError.
   */
  protected handleError(operation: string, error: unknown): never {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'SERVICE_ERROR';

    logger.error(`[${this.serviceName}] ${operation} failed: ${message}`, this.serviceName);
    throw new ServiceError(message, code, error);
  }

  /**
   * Log a successful operation at info level (no PII).
   */
  protected logOperation(operation: string, meta?: Record<string, unknown>): void {
    logger.info(
      `[${this.serviceName}] ${operation}${meta ? ' ' + JSON.stringify(meta) : ''}`,
      this.serviceName,
    );
  }

  /**
   * Validate that the current authenticated user has an org context.
   * Throws ServiceError if missing.
   */
  protected async validateOrgContext(): Promise<{ userId: string; orgId: string }> {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new ServiceError('غير مسجّل الدخول', 'NOT_AUTHENTICATED');
    }
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr || !profile?.organization_id) {
      throw new ServiceError('السياق التنظيمي غير متوفر', 'NO_ORG_CONTEXT');
    }
    return { userId: user.id, orgId: profile.organization_id };
  }
}
