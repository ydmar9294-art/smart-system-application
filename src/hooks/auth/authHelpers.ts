/**
 * Auth Helpers - Pure utility functions for auth state management
 * No side effects, no hooks — just pure transformations.
 */
import { UserRole, User, Organization, LicenseStatus } from '@/types';
import { CachedAuthState } from '@/lib/authCache';

/** Max time for the entire auth init before forcing to login (only when NO cache exists) */
export const HARD_TIMEOUT_MS = 3_000;
/** Max time for profile resolution */
export const RESOLVE_TIMEOUT_MS = 4_500;

export const deriveDisplayName = (fullName: string, email: string): string => {
  if (fullName && fullName.trim()) return fullName;
  if (email) return email.split('@')[0];
  return 'مستخدم';
};

export const buildUserFromCache = (cached: CachedAuthState): {
  user: User;
  role: UserRole;
  organization: Organization | null;
} => {
  const user: User = {
    id: cached.userId,
    name: deriveDisplayName(cached.fullName, cached.email),
    email: cached.email,
    role: cached.role,
    phone: '',
    employeeType: cached.employeeType || undefined,
  };
  const organization: Organization | null = cached.organizationId
    ? {
        id: cached.organizationId,
        name: cached.organizationName || '',
        licenseStatus: (cached.licenseStatus as LicenseStatus) || undefined,
        expiryDate: undefined,
      }
    : null;
  return { user, role: cached.role, organization };
};

export const isCacheFullyActivated = (cached: CachedAuthState): boolean => {
  return !!cached.organizationId && !!cached.role;
};

/** Check if the browser/app is currently online */
export const isNetworkAvailable = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Synchronously check if Supabase has stored auth tokens in localStorage.
 * This avoids waiting for INITIAL_SESSION to know if user might be logged in.
 */
export const hasSupabaseSessionInStorage = (): boolean => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return !!parsed?.access_token || !!parsed?.user;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return false;
};

/**
 * Determine initial loading state synchronously.
 * Only show skeleton if we have reason to believe a session exists (cache or stored tokens).
 * Otherwise, show login immediately — zero delay.
 */
export const shouldStartLoading = (): boolean => {
  const cached = getCachedAuthSync();
  if (cached && isCacheFullyActivated(cached)) return false; // Cache boot — no skeleton needed
  return hasSupabaseSessionInStorage(); // Only show skeleton if tokens exist
};

/** Sync version of getCachedAuth for use in initial state */
function getCachedAuthSync(): CachedAuthState | null {
  try {
    const raw = localStorage.getItem('auth_cache_v4');
    if (!raw) return null;
    return JSON.parse(raw) as CachedAuthState;
  } catch {
    return null;
  }
}
