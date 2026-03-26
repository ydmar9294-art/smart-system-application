/**
 * useAuthActions - Logout & refresh operations
 * Separated from state management for single-responsibility.
 */
import { useCallback, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authMutex } from '@/lib/concurrency';
import { getCachedAuth, clearAuthCache } from '@/lib/authCache';
import { clearEncryptionKey } from '@/lib/indexedDbEncryption';
import { clearDeviceState, notifyLogout } from '@/lib/deviceService';
import { clearAllCachedData } from '@/lib/offlineCache';
import { clearDistributorOfflineData } from '@/features/distributor/services/distributorOfflineService';
import { logger } from '@/lib/logger';
import { buildUserFromCache, isCacheFullyActivated, isNetworkAvailable } from './authHelpers';

interface AuthActionsDeps {
  resetToLogin: () => void;
  setAuthenticatedState: (result: { user: any; role: any; organization: any }) => void;
  setIsLoading: (v: boolean) => void;
  resolveProfile: (uid: string, isBackground?: boolean) => Promise<boolean>;
  isInternalAuthOp: MutableRefObject<boolean>;
  bootedFromCache: MutableRefObject<boolean>;
  lastResolvedUid: MutableRefObject<string | null>;
  inflightResolve: MutableRefObject<Promise<boolean> | null>;
}

export const useAuthActions = (deps: AuthActionsDeps) => {
  const {
    resetToLogin,
    setAuthenticatedState,
    setIsLoading,
    resolveProfile,
    isInternalAuthOp,
    bootedFromCache,
  } = deps;

  const logout = useCallback(async () => {
    return authMutex.withLock(async () => {
      isInternalAuthOp.current = true;
      try {
        // Dispatch event so App.tsx shows the goodbye screen immediately
        window.dispatchEvent(new CustomEvent('logout-started'));

        // Notify server of logout (marks device inactive + logs security event)
        await notifyLogout().catch(() => {});

        clearAuthCache();
        clearEncryptionKey().catch(() => {});
        clearDeviceState();
        clearAllCachedData().catch(() => {});
        clearDistributorOfflineData().catch(() => {});
        bootedFromCache.current = false;

        await supabase.auth.signOut().catch(() => {
          // Even if signOut fails, clear local state
        });

        // Small delay so the goodbye screen is visible
        await new Promise((r) => setTimeout(r, 1800));

        resetToLogin();
        window.dispatchEvent(new CustomEvent('logout-finished'));
      } finally {
        isInternalAuthOp.current = false;
      }
    });
  }, [resetToLogin, isInternalAuthOp, bootedFromCache]);

  const refreshAuth = useCallback(async () => {
    // Only refresh if online — never invalidate offline
    if (!isNetworkAvailable()) {
      logger.info('Skipping auth refresh — offline', 'Auth');
      return;
    }

    // If profile was JUST resolved (within last 15s), reuse cached data
    // This prevents double edge function calls when AuthFlow and useSession
    // both handle SIGNED_IN simultaneously on Capacitor
    const cached = getCachedAuth();
    if (cached && isCacheFullyActivated(cached) && (Date.now() - cached.cachedAt) < 15_000) {
      logger.info('Auth cache is very fresh — skipping re-resolution', 'Auth');
      const built = buildUserFromCache(cached);
      setAuthenticatedState(built);
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
      const fallback = getCachedAuth();
      if (fallback && isCacheFullyActivated(fallback)) {
        const built = buildUserFromCache(fallback);
        setAuthenticatedState(built);
      } else {
        resetToLogin();
      }
    }
  }, [resolveProfile, resetToLogin, setAuthenticatedState, setIsLoading]);

  return { logout, refreshAuth };
};
