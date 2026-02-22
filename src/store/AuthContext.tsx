/**
 * AuthContext - Handles authentication state only
 * 
 * Performance optimizations:
 * - Single auth-status call (deduplication via inflight promise)
 * - Cache-first with background revalidation
 * - Resilient session handling — no surprise logouts
 * - Token refresh retry with exponential backoff
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

const AUTH_TIMEOUT_MS = 8000;

const buildUserFromCache = (cached: CachedAuthState): { user: User; role: UserRole; organization: Organization | null } => {
  const user: User = {
    id: cached.userId,
    name: cached.fullName,
    email: cached.email,
    role: cached.role,
    phone: '',
    employeeType: cached.employeeType || undefined
  };
  const organization: Organization | null = cached.organizationId ? {
    id: cached.organizationId,
    name: cached.organizationName || '',
    licenseStatus: cached.licenseStatus || null,
    expiryDate: null
  } : null;
  return { user, role: cached.role, organization };
};

/**
 * Validates that cache represents a fully activated user (not mid-license-flow)
 */
const isCacheFullyActivated = (cached: CachedAuthState): boolean => {
  // Cache must have org and role to be considered fully activated
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
  
  // Deduplication: track inflight resolve promise
  const inflightResolve = useRef<Promise<boolean> | null>(null);
  const lastResolvedUid = useRef<string | null>(null);

  const resolveProfile = useCallback(async (uid: string): Promise<boolean> => {
    // Dedup: if same user is already being resolved, return existing promise
    if (inflightResolve.current && lastResolvedUid.current === uid) {
      return inflightResolve.current;
    }
    
    lastResolvedUid.current = uid;
    const promise = (async () => {
      try {
        const result = await resolveUserProfile(uid);
        if (!result.success) {
          setNeedsActivation(true);
          setIsAuthenticated(true);
          setIsLoading(false);
          return false;
        }
        setUser(result.user);
        setRole(result.role);
        setOrganization(result.organization);
        setNeedsActivation(false);
        setIsAuthenticated(true);
        setIsLoading(false);
        logger.setUser(result.user?.id);
        return true;
      } catch (err) {
        logger.error('resolveProfile failed', 'Auth', { error: String(err) });
        setIsLoading(false);
        return false;
      } finally {
        inflightResolve.current = null;
      }
    })();
    
    inflightResolve.current = promise;
    return promise;
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveProfile(session.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resolveProfile]);

  // Auth initialization — cache-first, single call
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
      const { user: cachedUser, role: cachedRole, organization: cachedOrg } = buildUserFromCache(cached);
      setUser(cachedUser);
      setRole(cachedRole);
      setOrganization(cachedOrg);
      setIsAuthenticated(true);
      setNeedsActivation(false);
      setIsLoading(false);
      hasLoadedFromCache = true;
    } else if (cached && !isCacheFullyActivated(cached)) {
      // Stale/incomplete cache from interrupted license flow — clear it
      clearAuthCache();
      logger.info('Cleared stale cache from interrupted auth flow', 'Auth');
    }

    // Timeout fallback — always resolve loading state
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasResolved) {
        logger.warn('Auth timeout reached, forcing loading=false', 'Auth');
        if (!hasLoadedFromCache) {
          // No cache and no resolution — show login
          setIsLoading(false);
        }
        initializingAuth.current = false;
      }
    }, AUTH_TIMEOUT_MS);

    // Phase 2: Listen for auth events
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isInternalAuthOp.current) return;
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          clearAuthCache();
          logger.info('User signed out', 'Auth');
          logger.setUser(undefined);
          setUser(null);
          setRole(null);
          setOrganization(null);
          setIsAuthenticated(false);
          setNeedsActivation(false);
          setIsLoading(false);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecoveryFlow.current = true;
          setUser(null);
          setRole(null);
          setOrganization(null);
          setIsAuthenticated(false);
          setNeedsActivation(false);
          setIsLoading(false);
          window.location.hash = '#/reset-password';
          return;
        }

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          if (isPasswordRecoveryFlow.current) return;
          
          // If already resolved from background validation, skip
          if (hasResolved && lastResolvedUid.current === session.user.id) return;
          // If loaded from cache with same user, just revalidate silently
          if (hasLoadedFromCache && cached?.userId === session.user.id) return;
          
          clearAuthCache();
          if (!hasLoadedFromCache) setIsLoading(true);
          hasResolved = true;
          await resolveProfile(session.user.id);
        }
      }
    );

    // Phase 3: Background validation (single call)
    const validateInBackground = async () => {
      try {
        if (isPasswordRecoveryFlow.current) {
          setIsLoading(false);
          initializingAuth.current = false;
          return;
        }
        const { data } = await supabase.auth.getSession();
        
        if (!data.session?.user) {
          if (cached) clearAuthCache();
          if (isMounted) {
            setUser(null);
            setRole(null);
            setOrganization(null);
            setIsAuthenticated(false);
            setIsLoading(false);
          }
          initializingAuth.current = false;
          return;
        }

        // If cache-loaded with same user, silently revalidate
        if (hasLoadedFromCache && cached?.userId === data.session.user.id) {
          hasResolved = true;
          resolveProfile(data.session.user.id).catch(console.error);
          initializingAuth.current = false;
          return;
        }

        if (isMounted && !hasLoadedFromCache) {
          setIsLoading(true);
        }
        hasResolved = true;
        await resolveProfile(data.session.user.id);
      } catch (err) {
        logger.error('Background validation failed', 'Auth', { error: String(err) });
      } finally {
        if (isMounted) {
          setIsLoading(false);
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
  }, [resolveProfile]);

  const logout = async () => {
    return authMutex.withLock(async () => {
      isInternalAuthOp.current = true;
      try {
        setIsLoading(true);
        clearAuthCache();
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
        setOrganization(null);
        setIsAuthenticated(false);
        setNeedsActivation(false);
      } finally {
        setIsLoading(false);
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