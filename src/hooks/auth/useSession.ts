/**
 * useSession - Session initialization, cache restore, and auth event handling
 * Manages the full lifecycle: cache boot → listener → session validation → online revalidation.
 * 
 * IMPORTANT: On Capacitor, AuthFlow handles SIGNED_IN for first-time logins.
 * useSession only handles: cache boot, TOKEN_REFRESHED, SIGNED_OUT, and online revalidation.
 */
import { useEffect, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuth, clearAuthCache, isAuthCacheFresh, CachedAuthState } from '@/lib/authCache';
import { verifyDevice } from '@/lib/deviceService';
import { logger } from '@/lib/logger';
import { buildUserFromCache, isCacheFullyActivated, isNetworkAvailable, HARD_TIMEOUT_MS } from './authHelpers';

interface SessionDeps {
  setUser: (u: any) => void;
  setRole: (r: any) => void;
  setOrganization: (o: any) => void;
  setIsAuthenticated: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  resetToLogin: () => void;
  setAuthenticatedState: (result: { user: any; role: any; organization: any }) => void;
  resolveProfile: (uid: string, isBackground?: boolean) => Promise<boolean>;
  initializingAuth: MutableRefObject<boolean>;
  isInternalAuthOp: MutableRefObject<boolean>;
  isPasswordRecoveryFlow: MutableRefObject<boolean>;
  lastResolvedUid: MutableRefObject<string | null>;
  bootedFromCache: MutableRefObject<boolean>;
}

export const useSession = (deps: SessionDeps) => {
  const {
    setUser,
    setRole,
    setOrganization,
    setIsAuthenticated,
    setIsLoading,
    resetToLogin,
    setAuthenticatedState,
    resolveProfile,
    initializingAuth,
    isInternalAuthOp,
    isPasswordRecoveryFlow,
    lastResolvedUid,
    bootedFromCache,
  } = deps;

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
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isInternalAuthOp.current) return;

      // INITIAL_SESSION: quickly show login when no session exists
      if (event === 'INITIAL_SESSION') {
        if (!session?.user && !bootedFromCache.current) {
          logger.info('INITIAL_SESSION: no session — showing login immediately', 'Auth');
          clearTimeout(timeoutId);
          hasResolved = true;
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
        }
        return;
      }

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

        // If already resolved for this user, skip
        if (hasResolved && lastResolvedUid.current === session.user.id) return;

        // If booted from cache for this same user, skip (background revalidation handles it below)
        if (bootedFromCache.current && cached?.userId === session.user.id) return;

        // For SIGNED_IN without cache: AuthFlow handles first-time login verification.
        // useSession only resolves if we have stale/partial cache or TOKEN_REFRESHED.
        if (event === 'SIGNED_IN' && !bootedFromCache.current) {
          // Let AuthFlow handle this — it shows loading phases and calls auth-status
          logger.info('SIGNED_IN without cache — deferring to AuthFlow', 'Auth');
          return;
        }

        // TOKEN_REFRESHED or SIGNED_IN with cache mismatch
        if (!bootedFromCache.current && isMounted) setIsLoading(true);
        hasResolved = true;
        await resolveProfile(session.user.id);
      }
    });

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
          if (bootedFromCache.current) {
            if (!isNetworkAvailable()) {
              logger.info('No session but offline — keeping cached auth', 'Auth');
              initializingAuth.current = false;
              return;
            }
            clearAuthCache();
            if (isMounted) resetToLogin();
            initializingAuth.current = false;
            return;
          }
          // No session, no cache — AuthFlow will show login screen
          // Don't call resetToLogin here if AuthFlow is already showing
          if (isMounted) resetToLogin();
          initializingAuth.current = false;
          return;
        }

        // Has session + loaded from cache → silently revalidate in background
        if (bootedFromCache.current && cached?.userId === data.session.user.id) {
          hasResolved = true;
          resolveProfile(data.session.user.id, true).catch(() => {
            logger.warn('Background revalidation failed, keeping cache', 'Auth');
          });
          initializingAuth.current = false;
          return;
        }

        // Has session but no cache → AuthFlow handles first-time login
        // We don't compete with AuthFlow here
        if (!bootedFromCache.current) {
          logger.info('Session found without cache — AuthFlow will handle', 'Auth');
          initializingAuth.current = false;
          return;
        }

        hasResolved = true;
        await resolveProfile(data.session.user.id);
      } catch (err) {
        logger.error('Session validation failed', 'Auth', { error: String(err) });
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

    // ── Phase 4: Listen for online events to trigger FULL background revalidation ──
    const handleOnline = async () => {
      if (!lastResolvedUid.current && !cached?.userId) return;

      logger.info('Network restored — running full background revalidation', 'Auth');

      // Step 1: Verify device is still active
      try {
        const deviceResult = await verifyDevice();
        if (!deviceResult.active) {
          logger.warn('Device revoked while offline — forcing logout', 'Auth');
          clearAuthCache();
          resetToLogin();
          window.dispatchEvent(new CustomEvent('device-revoked', {
            detail: { message: deviceResult.message || 'تم تسجيل الدخول من جهاز آخر' }
          }));
          return;
        }
      } catch {
        // Verification failed — don't block
      }

      // Step 2: Full background revalidation
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await resolveProfile(data.session.user.id, true);
        } else if (!bootedFromCache.current) {
          clearAuthCache();
          resetToLogin();
        }
      } catch {
        logger.warn('Online revalidation failed — keeping current state', 'Auth');
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setTimeout(handleOnline, 1500);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [resolveProfile, resetToLogin]); // eslint-disable-line react-hooks/exhaustive-deps
};
