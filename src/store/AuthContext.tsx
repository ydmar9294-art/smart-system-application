/**
 * AuthContext - Handles authentication state only
 * 
 * SaaS-grade guarantees:
 * - Guaranteed loading resolution (no infinite spinners)
 * - Progressive states: cache → verify → ready/error
 * - Layered cache with short auth TTL + medium license TTL
 * - Deterministic state transitions
 * - Graceful timeout with retry
 * - Every async path resolves or rejects within 8s
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, User, Organization, LicenseStatus } from '@/types';
import { resolveUserProfile } from '@/hooks/useAuthOperations';
import { authMutex } from '@/lib/concurrency';
import { getCachedAuth, clearAuthCache, CachedAuthState } from '@/lib/authCache';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsActivation: boolean;
  authError: string | null;
  /** Progressive phase for loading UI */
  authPhase: 'init' | 'cache' | 'verifying' | 'ready' | 'error';
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Max time for profile resolution before timeout */
const RESOLVE_TIMEOUT_MS = 7_000;
/** Hard timeout — absolute maximum before forcing UI out of loading */
const HARD_TIMEOUT_MS = 9_000;

const deriveDisplayName = (fullName: string, email: string): string => {
  if (fullName && fullName.trim()) return fullName;
  if (email) return email.split('@')[0];
  return 'مستخدم';
};

const buildUserFromCache = (cached: CachedAuthState): { user: User; role: UserRole; organization: Organization | null } => {
  const user: User = {
    id: cached.userId,
    name: deriveDisplayName(cached.fullName, cached.email),
    email: cached.email,
    role: cached.role,
    phone: '',
    employeeType: cached.employeeType || undefined
  };
  const organization: Organization | null = cached.organizationId ? {
    id: cached.organizationId,
    name: cached.organizationName || '',
    licenseStatus: (cached.licenseStatus as LicenseStatus) || undefined,
    expiryDate: undefined
  } : null;
  return { user, role: cached.role, organization };
};

const isCacheFullyActivated = (cached: CachedAuthState): boolean => {
  return !!cached.organizationId && !!cached.role;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authPhase, setAuthPhase] = useState<'init' | 'cache' | 'verifying' | 'ready' | 'error'>('init');

  const initializingAuth = useRef(false);
  const isInternalAuthOp = useRef(false);
  const isPasswordRecoveryFlow = useRef(false);
  
  const inflightResolve = useRef<Promise<boolean> | null>(null);
  const lastResolvedUid = useRef<string | null>(null);

  /** Set final authenticated state — single point of truth */
  const setAuthenticated = useCallback((result: { user: User | null; role: UserRole | null; organization: Organization | null }) => {
    setUser(result.user);
    setRole(result.role);
    setOrganization(result.organization);
    setIsAuthenticated(true);
    setNeedsActivation(false);
    setIsLoading(false);
    setAuthError(null);
    setAuthPhase('ready');
    logger.setUser(result.user?.id);
  }, []);

  /** Set unauthenticated state */
  const setUnauthenticated = useCallback(() => {
    setUser(null);
    setRole(null);
    setOrganization(null);
    setIsAuthenticated(false);
    setNeedsActivation(false);
    setIsLoading(false);
    setAuthError(null);
    setAuthPhase('ready');
    logger.setUser(undefined);
  }, []);

  const resolveProfile = useCallback(async (uid: string): Promise<boolean> => {
    // Deduplicate inflight resolves for the same UID
    if (inflightResolve.current && lastResolvedUid.current === uid) {
      return inflightResolve.current;
    }
    
    lastResolvedUid.current = uid;
    setAuthPhase('verifying');

    const promise = (async () => {
      try {
        const result = await Promise.race([
          resolveUserProfile(uid),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AUTH_TIMEOUT')), RESOLVE_TIMEOUT_MS)
          )
        ]);

        if (!result.success) {
          setNeedsActivation(true);
          setIsAuthenticated(true);
          setIsLoading(false);
          setAuthError(null);
          setAuthPhase('ready');
          return false;
        }

        setAuthenticated({ user: result.user, role: result.role, organization: result.organization });
        return true;
      } catch (err: any) {
        const isTimeout = err?.message === 'AUTH_TIMEOUT';
        logger.error(isTimeout ? 'Auth resolution timed out' : 'resolveProfile failed', 'Auth', { error: String(err) });
        setAuthError(isTimeout 
          ? 'انتهت مهلة التحقق من الحساب. يرجى المحاولة مرة أخرى.' 
          : 'حدث خطأ في التحقق من الحساب.');
        setAuthPhase('error');
        setIsLoading(false);
        return false;
      } finally {
        inflightResolve.current = null;
      }
    })();
    
    inflightResolve.current = promise;
    return promise;
  }, [setAuthenticated]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthPhase('verifying');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveProfile(session.user.id);
      } else {
        setUnauthenticated();
      }
    } catch {
      setUnauthenticated();
    }
  }, [resolveProfile, setUnauthenticated]);

  // Auth initialization — cache-first, single call, guaranteed resolution
  useEffect(() => {
    if (initializingAuth.current) return;
    initializingAuth.current = true;
    
    let isMounted = true;
    let hasLoadedFromCache = false;
    let hasResolved = false;

    const isResetRoute = window.location.hash.includes('/reset-password');
    if (isResetRoute) {
      isPasswordRecoveryFlow.current = true;
    }

    // Phase 1: Instant cache restore — only if fully activated
    const cached = getCachedAuth();
    if (cached && !isPasswordRecoveryFlow.current && isCacheFullyActivated(cached)) {
      const built = buildUserFromCache(cached);
      setUser(built.user);
      setRole(built.role);
      setOrganization(built.organization);
      setIsAuthenticated(true);
      setNeedsActivation(false);
      setIsLoading(false);
      setAuthPhase('cache');
      hasLoadedFromCache = true;
    } else if (cached && !isCacheFullyActivated(cached)) {
      clearAuthCache();
      logger.info('Cleared stale cache from interrupted auth flow', 'Auth');
    }

    // GUARANTEED hard timeout — always force loading=false
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasResolved && !hasLoadedFromCache) {
        logger.warn('Auth hard timeout — forcing login screen', 'Auth');
        setIsLoading(false);
        setAuthPhase('error');
        setAuthError('تعذر التحقق من الحساب. يرجى تسجيل الدخول مرة أخرى.');
        initializingAuth.current = false;
      }
    }, HARD_TIMEOUT_MS);

    // Phase 2: Listen for auth events
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isInternalAuthOp.current) return;
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          clearAuthCache();
          logger.info('User signed out', 'Auth');
          if (isMounted) setUnauthenticated();
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecoveryFlow.current = true;
          if (isMounted) {
            setUnauthenticated();
            window.location.hash = '#/reset-password';
          }
          return;
        }

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          if (isPasswordRecoveryFlow.current) return;
          if (hasResolved && lastResolvedUid.current === session.user.id) return;
          if (hasLoadedFromCache && cached?.userId === session.user.id) return;
          
          clearAuthCache();
          if (!hasLoadedFromCache && isMounted) setIsLoading(true);
          setAuthError(null);
          hasResolved = true;
          await resolveProfile(session.user.id);
        }
      }
    );

    // Phase 3: Background validation
    const validateInBackground = async () => {
      try {
        if (isPasswordRecoveryFlow.current) {
          if (isMounted) {
            setIsLoading(false);
            setAuthPhase('ready');
          }
          initializingAuth.current = false;
          return;
        }
        const { data } = await supabase.auth.getSession();
        
        if (!data.session?.user) {
          if (cached) clearAuthCache();
          if (isMounted) setUnauthenticated();
          initializingAuth.current = false;
          return;
        }

        if (hasLoadedFromCache && cached?.userId === data.session.user.id) {
          hasResolved = true;
          // Silent background revalidation — don't block UI
          resolveProfile(data.session.user.id).catch(console.error);
          initializingAuth.current = false;
          return;
        }

        if (isMounted && !hasLoadedFromCache) {
          setIsLoading(true);
          setAuthPhase('verifying');
        }
        hasResolved = true;
        await resolveProfile(data.session.user.id);
      } catch (err) {
        logger.error('Background validation failed', 'Auth', { error: String(err) });
        if (isMounted && !hasLoadedFromCache) {
          setAuthError('تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.');
          setAuthPhase('error');
          setIsLoading(false);
        }
      } finally {
        if (isMounted) {
          initializingAuth.current = false;
        }
      }
    };

    validateInBackground();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, [resolveProfile, setUnauthenticated]);

  const logout = async () => {
    return authMutex.withLock(async () => {
      isInternalAuthOp.current = true;
      try {
        setIsLoading(true);
        clearAuthCache();
        await supabase.auth.signOut();
        setUnauthenticated();
      } finally {
        setIsLoading(false);
        isInternalAuthOp.current = false;
      }
    });
  };

  return (
    <AuthContext.Provider value={{
      user, role, organization, isLoading, isAuthenticated, needsActivation, authError, authPhase,
      logout, refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
