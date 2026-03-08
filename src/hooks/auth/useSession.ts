/**
 * useSession - Session initialization, cache restore, and auth event handling
 * Manages the full lifecycle: cache boot → listener → session validation → online revalidation.
 */
import { useEffect, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuth, clearAuthCache, isAuthCacheFresh, CachedAuthState } from '@/lib/authCache';
import { verifyDevice } from '@/lib/deviceService';
import { logger } from '@/lib/logger';
import { buildUserFromCache, isCacheFullyActivated, isNetworkAvailable, HARD_TIMEOUT_MS } from './authHelpers';

interface SessionDeps {
  // State setters
  setUser: (u: any) => void;
  setRole: (r: any) => void;
  setOrganization: (o: any) => void;
  setIsAuthenticated: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  // Transitions
  resetToLogin: () => void;
  setAuthenticatedState: (result: { user: any; role: any; organization: any }) => void;
  // Profile resolver
  resolveProfile: (uid: string, isBackground?: boolean) => Promise<boolean>;
  // Refs
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

      // Use INITIAL_SESSION to quickly show login when no session exists (avoids silent wait in Capacitor WebView)
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
        if (hasResolved && lastResolvedUid.current === session.user.id) return;
        if (bootedFromCache.current && cached?.userId === session.user.id) return;

        // New login or different user — must resolve
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

        // Has session but no cache → must resolve before showing UI
        if (isMounted && !bootedFromCache.current) setIsLoading(true);
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
    // This runs regardless of cache state — whenever network is restored,
    // we verify: device status, account active, license status, subscription status.
    // All checks are silent (no loading indicators).
    const handleOnline = async () => {
      // Must have a resolved user to revalidate
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
        // Verification failed — don't block, continue with revalidation
      }

      // Step 2: Full background revalidation (account status, license, subscription, profile active)
      // resolveProfile with isBackground=true updates state silently without showing loading
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await resolveProfile(data.session.user.id, true);
        } else if (!bootedFromCache.current) {
          // No session and no cache — force login
          clearAuthCache();
          resetToLogin();
        }
      } catch {
        logger.warn('Online revalidation failed — keeping current state', 'Auth');
      }
    };

    // Also revalidate when app returns from background (Capacitor/mobile)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // Small delay to let network stabilize
        setTimeout(handleOnline, 1500);
      }
    };

    // Stagger: AccountStatusGate fires at 2s, so useSession fires at 0s (device check first)
    // then resolveProfile at ~1s (after device check completes)
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
