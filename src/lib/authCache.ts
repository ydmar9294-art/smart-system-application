/**
 * Auth Cache - Layered caching strategy (SaaS standard)
 * 
 * Layer 1: Memory cache (instant, per-tab)
 * Layer 2: sessionStorage (survives refresh, per-tab)
 * 
 * TTL Strategy:
 * - Session/auth state: 5 minutes (short-lived)
 * - License status: 15 minutes (medium-lived)
 * - No permanent cache for auth decisions
 * 
 * Invalidation triggers:
 * - Logout
 * - Password change
 * - License change/expiration
 * - Role/permission update
 */

import { UserRole, EmployeeType, LicenseStatus } from '@/types';

const CACHE_KEY = 'auth_cache_v3';
const CACHE_VERSION = 3;

// Layered TTLs
const AUTH_TTL_MS = 5 * 60 * 1000;     // 5 min for auth state
const LICENSE_TTL_MS = 15 * 60 * 1000;  // 15 min for license

export interface CachedAuthState {
  userId: string;
  role: UserRole;
  employeeType?: EmployeeType | null;
  organizationId?: string | null;
  organizationName?: string | null;
  licenseStatus?: LicenseStatus | null;
  fullName: string;
  email: string;
  cachedAt: number;
  version: number;
}

// In-memory cache for zero-latency access
let memoryCache: CachedAuthState | null = null;

/**
 * Check if auth data is still valid (short TTL)
 */
export const isAuthCacheValid = (cache: CachedAuthState | null): boolean => {
  if (!cache) return false;
  if (cache.version !== CACHE_VERSION) return false;
  return (Date.now() - cache.cachedAt) < AUTH_TTL_MS;
};

/**
 * Check if license data is still valid (medium TTL)
 */
export const isLicenseCacheValid = (cache: CachedAuthState | null): boolean => {
  if (!cache) return false;
  if (cache.version !== CACHE_VERSION) return false;
  return (Date.now() - cache.cachedAt) < LICENSE_TTL_MS;
};

/** @deprecated Use isAuthCacheValid instead */
export const isCacheValid = isAuthCacheValid;

export const getCachedAuth = (): CachedAuthState | null => {
  // Memory cache first (instant)
  if (memoryCache && isAuthCacheValid(memoryCache)) {
    return memoryCache;
  }
  
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached) as CachedAuthState;
    
    if (!isAuthCacheValid(parsed)) {
      clearAuthCache();
      return null;
    }
    
    // Populate memory cache
    memoryCache = parsed;
    return parsed;
  } catch {
    clearAuthCache();
    return null;
  }
};

/**
 * Get cached license status even if auth cache expired (medium TTL)
 */
export const getCachedLicense = (): CachedAuthState | null => {
  if (memoryCache && isLicenseCacheValid(memoryCache)) {
    return memoryCache;
  }
  
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedAuthState;
    if (!isLicenseCacheValid(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedAuth = (state: Omit<CachedAuthState, 'cachedAt' | 'version'>): void => {
  try {
    const cacheData: CachedAuthState = {
      ...state,
      cachedAt: Date.now(),
      version: CACHE_VERSION,
    };
    memoryCache = cacheData;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    // sessionStorage might be full or unavailable
    console.warn('[AuthCache] Failed to persist:', e);
  }
};

export const clearAuthCache = (): void => {
  memoryCache = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
    // Also clear old cache keys
    sessionStorage.removeItem('auth_cache_v1');
    sessionStorage.removeItem('auth_cache_v2');
  } catch {
    // Ignore
  }
};

export const validateCacheWithSession = (sessionUserId: string): boolean => {
  const cached = getCachedAuth();
  return cached?.userId === sessionUserId;
};
