/**
 * Session Guard (Phase 4)
 * Proactive token refresh with jitter to prevent thundering herd.
 * Monitors token expiry and refreshes BEFORE it expires.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // Refresh 5 min before expiry
const MAX_JITTER_MS = 30_000; // Random 0-30s jitter to spread load

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;

function getJitter(): number {
  return Math.floor(Math.random() * MAX_JITTER_MS);
}

/**
 * Schedules a proactive token refresh before the session expires.
 * Adds jitter to prevent all clients refreshing simultaneously.
 */
export function scheduleTokenRefresh(expiresAt: number) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = (expiresAt - now) * 1000; // Convert to ms
  const refreshIn = Math.max(timeUntilExpiry - REFRESH_MARGIN_MS + getJitter(), 5000);

  logger.debug(`Token refresh scheduled in ${Math.round(refreshIn / 1000)}s`, 'SessionGuard');

  refreshTimer = setTimeout(async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        logger.warn('Proactive token refresh failed, will retry', 'SessionGuard', { error: error.message });
        // Retry after 30s + jitter
        setTimeout(() => {
          isRefreshing = false;
          scheduleTokenRefresh(expiresAt);
        }, 30_000 + getJitter());
        return;
      }
      if (data.session?.expires_at) {
        logger.info('Token refreshed proactively', 'SessionGuard');
        scheduleTokenRefresh(data.session.expires_at);
      }
    } catch (err) {
      logger.error('Token refresh error', 'SessionGuard', { error: String(err) });
    } finally {
      isRefreshing = false;
    }
  }, refreshIn);
}

export function cancelTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Initialize session guard — listens for auth events and schedules refresh.
 */
export function initSessionGuard() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      cancelTokenRefresh();
      return;
    }

    if (session?.expires_at && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
      scheduleTokenRefresh(session.expires_at);
    }
  });

  // Also check current session on init
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.expires_at) {
      scheduleTokenRefresh(data.session.expires_at);
    }
  });
}
