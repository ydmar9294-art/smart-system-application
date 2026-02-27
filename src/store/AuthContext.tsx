/**
 * AuthContext - Offline-first, persistent authentication v2
 * 
 * Design principles:
 * - PERSISTENT LOGIN: After first successful login, user stays logged in forever.
 * - OFFLINE-FIRST: App boots from localStorage cache instantly, no network needed.
 * - NEVER logout offline: Only server-side account changes can force logout.
 * - Background revalidation: When online, silently verify account status.
 * - No stuck states: Hard timeout only applies to FIRST-EVER login (no cache).
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, User, Organization, LicenseStatus } from '@/types';
import { resolveUserProfile } from '@/hooks/useAuthOperations';
import { authMutex } from '@/lib/concurrency';
import { getCachedAuth, clearAuthCache, isAuthCacheFresh, CachedAuthState } from '@/lib/authCache';
import { logger } from '@/lib/logger';
import { clearEncryptionKey } from '@/lib/indexedDbEncryption';

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

/** Max time for the entire auth init before forcing to login (only when NO cache exists) */
const HARD_TIMEOUT_MS = 5_000;
/** Max time for profile resolution */
const RESOLVE_TIMEOUT_MS = 4_500;

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

/** Check if the browser/app is currently online */
const isNetworkAvailable = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
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
  const bootedFromCache = useRef(false);

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

  const resolveProfile = useCallback(async (uid: string, isBackground = false): Promise<boolean> => {
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
          if (!isBackground) {
            setNeedsActivation(true);
            setIsAuthenticated(true);
            setIsLoading(false);
          }
          return false;
        }

        setAuthenticatedState({ user: result.user, role: result.role, organization: result.organization });
        return true;
      } catch (err: any) {
        // CRITICAL: If we booted from cache and this is a background revalidation,
        // do NOT logout the user. Keep the cached state.
        if (bootedFromCache.current || isBackground) {
          logger.warn('Background revalidation failed, keeping cached state', 'Auth', { error: String(err) });
          return false;
        }
        
        // Only clear cache and logout if this is a foreground resolve with no cache fallback
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
    // Only refresh if online — never invalidate offline
    if (!isNetworkAvailable()) {
      logger.info('Skipping auth refresh — offline', 'Auth');
      return;
    }
    
    // Clear cache and re-query to get fresh license/profile status
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
      // If refresh fails (e.g. network dropped), don't logout
      const cached = getCachedAuth();
      if (cached && isCacheFullyActivated(cached)) {
        const built = buildUserFromCache(cached);
        setAuthenticatedState(built);
      } else {
        resetToLogin();
      }
    }
  }, [resolveProfile, resetToLogin, setAuthenticatedState]);

  // ==========================================
  // AUTH INITIALIZATION
  // Persistent, offline-first, cache-driven
  // ==========================================
  useEffect(() => {
    if (initializingAuth.current) return;
    initializingAuth.current = true;
    
    let isMounted = true;
    let hasResolved = false;

    const isResetRoute = window.location.hash.includes('/reset-password');
    if (isResetRoute) {
      isPasswordRecoveryFlow.current = true;
    }

    // ── Phase 1: Instant cache restore (ALWAYS — no TTL check) ──
    const cached = getCachedAuth();
    if (cached && !isPasswordRecoveryFlow.current && isCacheFullyActivated(cached)) {
      const built = buildUserFromCache(cached);
      setUser(built.user);
      setRole(built.role);
      setOrganization(built.organization);
      setIsAuthenticated(true);
      setNeedsActivation(false);
      setIsLoading(false);
      bootedFromCache.current = true;
    } else if (cached && !isCacheFullyActivated(cached)) {
      clearAuthCache();
    }

    // ── Hard timeout: ONLY if no cache (first-ever login) ──
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasResolved && !bootedFromCache.current) {
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
          if (bootedFromCache.current && cached?.userId === session.user.id) return;
          
          // New login or different user — must resolve
          if (!bootedFromCache.current && isMounted) setIsLoading(true);
          hasResolved = true;
          await resolveProfile(session.user.id);
        }
      }
    );

    // ── Phase 3: Session validation (online-aware) ──
    const validateSession = async () => {
      try {
        if (isPasswordRecoveryFlow.current) {
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
          return;
        }

        // If we booted from cache and are OFFLINE, skip session validation entirely
        if (bootedFromCache.current && !isNetworkAvailable()) {
          logger.info('Offline boot with cache — skipping session validation', 'Auth');
          initializingAuth.current = false;
          return;
        }

        // If we booted from cache and cache is fresh, skip immediate revalidation
        if (bootedFromCache.current && isAuthCacheFresh(cached)) {
          logger.info('Cache is fresh — skipping immediate revalidation', 'Auth');
          initializingAuth.current = false;
          return;
        }

        const { data } = await supabase.auth.getSession();
        
        if (!data.session?.user) {
          // No session from Supabase
          if (bootedFromCache.current) {
            // We have a cache but no Supabase session — likely token expired
            // If offline, keep cached state. If online, this means session truly expired.
            if (!isNetworkAvailable()) {
              logger.info('No session but offline — keeping cached auth', 'Auth');
              initializingAuth.current = false;
              return;
            }
            // Online with no session = session expired, must re-login
            clearAuthCache();
            if (isMounted) resetToLogin();
            initializingAuth.current = false;
            return;
          }
          // No cache, no session → login
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
          return;
        }

        // Has session + loaded from cache → silently revalidate in background
        if (bootedFromCache.current && cached?.userId === data.session.user.id) {
          hasResolved = true;
          resolveProfile(data.session.user.id, true).catch(() => {
            // Background revalidation failed — keep cached state
            logger.warn('Background revalidation failed, keeping cache', 'Auth');
          });
          initializingAuth.current = false;
          return;
        }

        // Has session but no cache → must resolve before showing UI
        if (isMounted && !bootedFromCache.current) setIsLoading(true);
        hasResolved = true;
        await resolveProfile(data.session.user.id);
      } catch (err) {
        logger.error('Session validation failed', 'Auth', { error: String(err) });
        // CRITICAL: If booted from cache, do NOT logout on validation failure
        if (bootedFromCache.current) {
          logger.info('Session validation error but cache exists — keeping auth', 'Auth');
        } else if (isMounted) {
          clearAuthCache();
          resetToLogin();
        }
      } finally {
        if (isMounted) initializingAuth.current = false;
      }
    };

    validateSession();

    // ── Phase 4: Listen for online events to trigger background revalidation ──
    const handleOnline = () => {
      if (bootedFromCache.current && cached) {
        logger.info('Network restored — triggering background revalidation', 'Auth');
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) {
            resolveProfile(data.session.user.id, true).catch(() => {
              logger.warn('Online revalidation failed — keeping cache', 'Auth');
            });
          }
        }).catch(() => {
          // Ignore — will retry next time
        });
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
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
        clearEncryptionKey();
        bootedFromCache.current = false;
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
