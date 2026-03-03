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
