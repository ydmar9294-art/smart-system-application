/**
 * Persistent OAuth State Manager
 * 
 * Tracks whether an OAuth flow is in progress using localStorage.
 * This survives the browser→app transition on Capacitor (Android).
 * 
 * Flow:
 * 1. User taps "Sign in with Google" → setOAuthPending(true)
 * 2. Browser opens, user authenticates
 * 3. Deep link returns → app resumes with pending=true → shows loading
 * 4. Session established → clearOAuthPending()
 * 
 * Safety: auto-expires after MAX_AGE_MS to prevent stuck states.
 */

const OAUTH_KEY = 'oauth_pending';
const MAX_AGE_MS = 120_000; // 2 minutes max

interface OAuthPendingState {
  timestamp: number;
}

export function setOAuthPending(): void {
  try {
    const state: OAuthPendingState = { timestamp: Date.now() };
    localStorage.setItem(OAUTH_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be unavailable
  }
}

export function isOAuthPending(): boolean {
  try {
    const raw = localStorage.getItem(OAUTH_KEY);
    if (!raw) return false;
    
    const state: OAuthPendingState = JSON.parse(raw);
    const elapsed = Date.now() - state.timestamp;
    
    if (elapsed > MAX_AGE_MS) {
      clearOAuthPending();
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export function clearOAuthPending(): void {
  try {
    localStorage.removeItem(OAUTH_KEY);
  } catch {
    // Safe to ignore
  }
}
