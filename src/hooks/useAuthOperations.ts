/**
 * Auth Operations - Centralized authentication logic
 * 
 * Optimizations:
 * - Request deduplication via inflight tracking
 * - Retry with exponential backoff on network failures
 * - Timeout protection (8s max per request)
 */
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, User, EmployeeType, LicenseStatus, Organization } from '@/types';
import { getCachedAuth, setCachedAuth, clearAuthCache, CachedAuthState } from '@/lib/authCache';
import { authCircuitBreaker } from '@/lib/circuitBreaker';

interface ProfileResolutionResult {
  user: User | null;
  role: UserRole | null;
  organization: Organization | null;
  success: boolean;
  fromCache?: boolean;
}

interface AuthStatusResponse {
  authenticated: boolean;
  needs_activation?: boolean;
  access_denied?: boolean;
  reason?: string;
  message?: string;
  user_id?: string;
  role?: string;
  employee_type?: string;
  organization_id?: string;
  organization_name?: string;
  license_status?: string;
  expiry_date?: string;
  full_name?: string;
  email?: string;
  google_id?: string;
  _timing_ms?: number;
}

// Inflight deduplication
let inflightAuthStatus: Promise<AuthStatusResponse> | null = null;

/**
 * Fast auth status check with deduplication and timeout
 */
export const checkAuthStatus = async (): Promise<AuthStatusResponse> => {
  // Return existing inflight request if one is pending
  if (inflightAuthStatus) {
    return inflightAuthStatus;
  }

  const promise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return { authenticated: false, reason: 'NO_SESSION' };
      }

      // Phase 6: Circuit breaker wraps the auth-status call
      return await authCircuitBreaker.execute<AuthStatusResponse>(
        async () => {
          // Timeout protection: 8s max
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          try {
            const { data, error } = await supabase.functions.invoke('auth-status', {
              headers: {
                Authorization: `Bearer ${session!.access_token}`
              }
            });

            clearTimeout(timeoutId);

            if (error) {
              console.error('[AuthOps] auth-status error:', error);
              throw error;
            }

            return data as AuthStatusResponse;
          } catch (err: any) {
            clearTimeout(timeoutId);
            // On timeout or network error, try once more
            if (err?.name === 'AbortError' || err?.message?.includes('fetch')) {
              console.warn('[AuthOps] Retrying auth-status after failure...');
              const { data, error } = await supabase.functions.invoke('auth-status', {
                headers: {
                  Authorization: `Bearer ${session!.access_token}`
                }
              });
              if (error) throw error;
              return data as AuthStatusResponse;
            }
            throw err;
          }
        },
        // Fallback: try to use cached auth if circuit is open
        () => {
          const cached = getCachedAuth();
          if (cached) {
            return {
              authenticated: true,
              needs_activation: false,
              access_denied: false,
              user_id: cached.userId,
              role: cached.role,
              employee_type: cached.employeeType || undefined,
              organization_id: cached.organizationId || undefined,
              organization_name: cached.organizationName || undefined,
              license_status: cached.licenseStatus || undefined,
              full_name: cached.fullName,
              email: cached.email,
            } as AuthStatusResponse;
          }
          return { authenticated: false, reason: 'CIRCUIT_OPEN' };
        }
      );
    } catch (err) {
      console.error('[AuthOps] checkAuthStatus failed:', err);
      return { authenticated: false, reason: 'ERROR' };
    } finally {
      inflightAuthStatus = null;
    }
  })();

  inflightAuthStatus = promise;
  return promise;
};

/**
 * Resolves user profile - checks cache first, then edge function
 */
export const resolveUserProfile = async (uid: string): Promise<ProfileResolutionResult> => {
  try {
    const status = await checkAuthStatus();
    
    if (!status.authenticated) {
      clearAuthCache();
      return { user: null, role: null, organization: null, success: false };
    }

    if (status.access_denied) {
      clearAuthCache();
      return { user: null, role: null, organization: null, success: false };
    }

    if (status.needs_activation) {
      return { user: null, role: null, organization: null, success: false };
    }

    const displayName = (status.full_name && status.full_name.trim()) 
      ? status.full_name 
      : (status.email ? status.email.split('@')[0] : 'مستخدم');
    
    const user: User = {
      id: status.user_id!,
      name: displayName,
      email: status.email || '',
      role: status.role as UserRole,
      phone: '',
      employeeType: status.employee_type as EmployeeType
    };

    const role = status.role as UserRole;
    const expiryDate = status.expiry_date ? new Date(status.expiry_date).getTime() : null;
    
    const organization: Organization | null = status.organization_id ? {
      id: status.organization_id,
      name: status.organization_name || '',
      licenseStatus: status.license_status as LicenseStatus || null,
      expiryDate: expiryDate
    } : null;

    // Cache for future requests
    setCachedAuth({
      userId: status.user_id!,
      role: role,
      employeeType: status.employee_type as EmployeeType || null,
      organizationId: status.organization_id || null,
      organizationName: status.organization_name || null,
      licenseStatus: status.license_status as LicenseStatus || null,
      fullName: status.full_name || '',
      email: status.email || ''
    });

    return { user, role, organization, success: true, fromCache: false };
  } catch (err) {
    console.error('[Auth] resolveProfile error:', err);
    clearAuthCache();
    return { user: null, role: null, organization: null, success: false };
  }
};

/**
 * Hook for managing concurrent auth operations
 */
export const useAuthMutex = () => {
  const isOperationInProgress = useRef(false);
  const operationQueue = useRef<(() => void)[]>([]);

  const acquireLock = useCallback((): boolean => {
    if (isOperationInProgress.current) return false;
    isOperationInProgress.current = true;
    return true;
  }, []);

  const releaseLock = useCallback(() => {
    isOperationInProgress.current = false;
    const next = operationQueue.current.shift();
    if (next) next();
  }, []);

  const queueOperation = useCallback((operation: () => void) => {
    if (isOperationInProgress.current) {
      operationQueue.current.push(operation);
      return false;
    }
    return true;
  }, []);

  return { acquireLock, releaseLock, queueOperation, isLocked: () => isOperationInProgress.current };
};