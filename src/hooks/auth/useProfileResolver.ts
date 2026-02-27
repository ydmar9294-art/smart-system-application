/**
 * useProfileResolver - Resolves user profile from auth-status edge function
 * Handles deduplication, timeout, and cache-aware error handling.
 */
import { useCallback, MutableRefObject } from 'react';
import { resolveUserProfile } from '@/hooks/useAuthOperations';
import { clearAuthCache } from '@/lib/authCache';
import { registerDevice } from '@/lib/deviceService';
import { logger } from '@/lib/logger';
import { RESOLVE_TIMEOUT_MS } from './authHelpers';

interface ProfileResolverDeps {
  setAuthenticatedState: (result: { user: any; role: any; organization: any }) => void;
  resetToLogin: () => void;
  setActivationRequired: () => void;
  inflightResolve: MutableRefObject<Promise<boolean> | null>;
  lastResolvedUid: MutableRefObject<string | null>;
  bootedFromCache: MutableRefObject<boolean>;
}

export const useProfileResolver = (deps: ProfileResolverDeps) => {
  const {
    setAuthenticatedState,
    resetToLogin,
    setActivationRequired,
    inflightResolve,
    lastResolvedUid,
    bootedFromCache,
  } = deps;

  const resolveProfile = useCallback(
    async (uid: string, isBackground = false): Promise<boolean> => {
      // Deduplicate inflight requests for the same user
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
            ),
          ]);

          if (!result.success) {
            // No profile or needs activation — not an error
            if (!isBackground) {
              setActivationRequired();
            }
            return false;
          }

          setAuthenticatedState({
            user: result.user,
            role: result.role,
            organization: result.organization,
          });

          // Register device after successful auth (fire-and-forget, non-blocking)
          registerDevice().catch((err) => {
            logger.warn('Device registration failed (non-blocking)', 'Auth', { error: String(err) });
          });

          return true;
        } catch (err: any) {
          // CRITICAL: If we booted from cache and this is a background revalidation,
          // do NOT logout the user. Keep the cached state.
          if (bootedFromCache.current || isBackground) {
            logger.warn('Background revalidation failed, keeping cached state', 'Auth', {
              error: String(err),
            });
            return false;
          }

          // Only clear cache and logout if this is a foreground resolve with no cache fallback
          logger.warn('Profile resolution failed, degrading to login', 'Auth', {
            error: String(err),
          });
          clearAuthCache();
          resetToLogin();
          return false;
        } finally {
          inflightResolve.current = null;
        }
      })();

      inflightResolve.current = promise;
      return promise;
    },
    [setAuthenticatedState, resetToLogin, setActivationRequired, inflightResolve, lastResolvedUid, bootedFromCache]
  );

  return { resolveProfile };
};
