/**
 * AuthContext - SaaS-grade authentication state
 * 
 * Design principles:
 * - NEVER show error screens. Failures degrade to login.
 * - Cache-first for instant UI, background verify for freshness.
 * - Every async path resolves within 7s absolute max.
 * - No stuck loading states — guaranteed.
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
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Max time for the entire auth init before forcing to login */
const HARD_TIMEOUT_MS = 7_000;
/** Max time for profile resolution */
const RESOLVE_TIMEOUT_MS = 6_000;

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

  const initializingAuth = useRef(false);
  const isInternalAuthOp = useRef(false);
  const isPasswordRecoveryFlow = useRef(false);
  const inflightResolve = useRef<Promise<boolean> | null>(null);
  const lastResolvedUid = useRef<string | null>(null);

  /** Transition to authenticated state */
  const setAuthenticatedState = useCallback((result: { user: User | null; role: UserRole | null; organization: Organization | null }) => {
    setUser(result.user);
    setRole(result.role);
    setOrganization(result.organization);
    setIsAuthenticated(true);
    setNeedsActivation(false);
    setIsLoading(false);
    logger.setUser(result.user?.id);
  }, []);

  /** Transition to unauthenticated — shows login screen, NEVER an error */
  const resetToLogin = useCallback(() => {
    setUser(null);
    setRole(null);
    setOrganization(null);
    setIsAuthenticated(false);
    setNeedsActivation(false);
    setIsLoading(false);
    logger.setUser(undefined);
  }, []);

  const resolveProfile = useCallback(async (uid: string): Promise<boolean> => {
    if (inflightResolve.current && lastResolvedUid.current === uid) {
      return inflightResolve.current;
    }
    
    lastResolvedUid.current = uid;

    const promise = (async () => {
      try {
        const result = await Promise.race([
          resolveUserProfile(uid),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AUTH_TIMEOUT')), RESOLVE_TIMEOUT_MS)
          )
        ]);

        if (!result.success) {
          // No profile or needs activation — not an error
          setNeedsActivation(true);
          setIsAuthenticated(true);
          setIsLoading(false);
          return false;
        }

        setAuthenticatedState({ user: result.user, role: result.role, organization: result.organization });
        return true;
      } catch (err: any) {
        // On ANY failure (timeout, network, etc.) → degrade to login
        logger.warn('Profile resolution failed, degrading to login', 'Auth', { error: String(err) });
        clearAuthCache();
        resetToLogin();
        return false;
      } finally {
        inflightResolve.current = null;
      }
    })();
    
    inflightResolve.current = promise;
    return promise;
  }, [setAuthenticatedState, resetToLogin]);

  const refreshAuth = useCallback(async () => {
    // Always clear cache and re-query to get fresh license/profile status
    // This is critical for reactivation flows where cached status is stale
    clearAuthCache();
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveProfile(session.user.id);
      } else {
        resetToLogin();
      }
    } catch {
      resetToLogin();
    }
  }, [resolveProfile, resetToLogin]);

  // ==========================================
  // AUTH INITIALIZATION
  // Single-pass, cache-first, guaranteed resolution
  // ==========================================
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

    // ── Phase 1: Instant cache restore ──
    const cached = getCachedAuth();
    if (cached && !isPasswordRecoveryFlow.current && isCacheFullyActivated(cached)) {
      const built = buildUserFromCache(cached);
      setUser(built.user);
      setRole(built.role);
      setOrganization(built.organization);
      setIsAuthenticated(true);
      setNeedsActivation(false);
      setIsLoading(false);
      hasLoadedFromCache = true;
    } else if (cached && !isCacheFullyActivated(cached)) {
      clearAuthCache();
    }

    // ── Hard timeout: absolute guarantee against stuck states ──
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasResolved && !hasLoadedFromCache) {
        logger.warn('Auth hard timeout — falling back to login', 'Auth');
        clearAuthCache();
        resetToLogin();
        initializingAuth.current = false;
      }
    }, HARD_TIMEOUT_MS);

    // ── Phase 2: Auth event listener ──
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isInternalAuthOp.current) return;
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          clearAuthCache();
          if (isMounted) resetToLogin();
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecoveryFlow.current = true;
          if (isMounted) {
            resetToLogin();
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
          hasResolved = true;
          await resolveProfile(session.user.id);
        }
      }
    );

    // ── Phase 3: Background session validation ──
    const validateSession = async () => {
      try {
        if (isPasswordRecoveryFlow.current) {
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
          return;
        }

        const { data } = await supabase.auth.getSession();
        
        if (!data.session?.user) {
          // No session → show login immediately
          if (cached) clearAuthCache();
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
          return;
        }

        // Has session + loaded from cache → silently revalidate in background
        if (hasLoadedFromCache && cached?.userId === data.session.user.id) {
          hasResolved = true;
          resolveProfile(data.session.user.id).catch(() => {
            // Background revalidation failed — keep cached state, don't break UI
            logger.warn('Background revalidation failed, keeping cache', 'Auth');
          });
          initializingAuth.current = false;
          return;
        }

        // Has session but no cache → must resolve before showing UI
        if (isMounted && !hasLoadedFromCache) setIsLoading(true);
        hasResolved = true;
        await resolveProfile(data.session.user.id);
      } catch (err) {
        logger.error('Session validation failed', 'Auth', { error: String(err) });
        if (isMounted && !hasLoadedFromCache) {
          clearAuthCache();
          resetToLogin();
        }
      } finally {
        if (isMounted) initializingAuth.current = false;
      }
    };

    validateSession();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, [resolveProfile, resetToLogin]);

  // ==========================================
  // LOGOUT
  // ==========================================
  const logout = async () => {
    return authMutex.withLock(async () => {
      isInternalAuthOp.current = true;
      try {
        clearAuthCache();
        // Sign out first, then update UI
        await supabase.auth.signOut().catch(() => {
          // Even if signOut fails, clear local state
        });
        resetToLogin();
      } finally {
        isInternalAuthOp.current = false;
      }
    });
  };

  return (
    <AuthContext.Provider value={{
      user, role, organization, isLoading, isAuthenticated, needsActivation,
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
