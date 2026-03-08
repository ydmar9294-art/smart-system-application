/**
 * useAuthActions - Logout & refresh operations
 * Separated from state management for single-responsibility.
 */
import { useCallback, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authMutex } from '@/lib/concurrency';
import { getCachedAuth, clearAuthCache } from '@/lib/authCache';
import { clearEncryptionKey } from '@/lib/indexedDbEncryption';
import { clearDeviceState } from '@/lib/deviceService';
import { clearAllCachedData } from '@/lib/offlineCache';
import { logger } from '@/lib/logger';
import { buildUserFromCache, isCacheFullyActivated, isNetworkAvailable } from './authHelpers';

interface AuthActionsDeps {
  resetToLogin: () => void;
  setAuthenticatedState: (result: { user: any; role: any; organization: any }) => void;
  setIsLoading: (v: boolean) => void;
  resolveProfile: (uid: string, isBackground?: boolean) => Promise<boolean>;
  isInternalAuthOp: MutableRefObject<boolean>;
  bootedFromCache: MutableRefObject<boolean>;
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

        clearAuthCache();
        clearEncryptionKey();
        clearDeviceState();
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
  }, [resolveProfile, resetToLogin, setAuthenticatedState, setIsLoading]);

  return { logout, refreshAuth };
};
