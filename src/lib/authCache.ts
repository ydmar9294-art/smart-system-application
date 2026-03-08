/**
import { logger } from '@/lib/logger';
/**
 * Auth Cache - Persistent offline-first caching strategy
 * 
 * Layer 1: Memory cache (instant, per-tab)
 * Layer 2: localStorage (survives app restarts, persistent)
 * 
 * Boot Strategy:
 * - On app launch, load from localStorage immediately — no TTL check for boot.
 * - Background revalidation refreshes cache when online.
 * - Cache is only cleared on explicit logout or server-side account invalidation.
 * 
 * Invalidation triggers:
 * - Manual logout
 * - Server confirms account deactivated / suspended / revoked
 */

import { UserRole, EmployeeType, LicenseStatus } from '@/types';

const CACHE_KEY = 'auth_cache_v4';
const CACHE_VERSION = 4;

// TTLs for ONLINE revalidation decisions only (not boot blocking)
const REVALIDATION_TTL_MS = 5 * 60 * 1000;     // 5 min — triggers background revalidation
const LICENSE_TTL_MS = 15 * 60 * 1000;          // 15 min for license freshness

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
 * Check if cache exists and is structurally valid (no TTL — always valid for boot)
 */
export const isCacheStructurallyValid = (cache: CachedAuthState | null): boolean => {
  if (!cache) return false;
  if (cache.version !== CACHE_VERSION) return false;
  if (!cache.userId || !cache.role) return false;
  return true;
};

/**
 * Check if cache is fresh enough to skip online revalidation
 */
export const isAuthCacheFresh = (cache: CachedAuthState | null): boolean => {
  if (!isCacheStructurallyValid(cache)) return false;
  return (Date.now() - cache!.cachedAt) < REVALIDATION_TTL_MS;
};

/**
 * Check if license data is still fresh (medium TTL)
 */
export const isLicenseCacheValid = (cache: CachedAuthState | null): boolean => {
  if (!isCacheStructurallyValid(cache)) return false;
  return (Date.now() - cache!.cachedAt) < LICENSE_TTL_MS;
};

/** @deprecated Use isAuthCacheFresh for revalidation checks */
export const isAuthCacheValid = isAuthCacheFresh;
/** @deprecated */
export const isCacheValid = isAuthCacheFresh;

/**
 * Get cached auth state for BOOT — no TTL enforcement.
 * Returns cached state as long as it's structurally valid.
 */
export const getCachedAuth = (): CachedAuthState | null => {
  // Memory cache first (instant)
  if (memoryCache && isCacheStructurallyValid(memoryCache)) {
    return memoryCache;
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      // Migration: check old sessionStorage keys
      const oldCache = sessionStorage.getItem('auth_cache_v3');
      if (oldCache) {
        const parsed = JSON.parse(oldCache) as any;
        if (parsed && parsed.userId && parsed.role) {
          // Migrate to new format in localStorage
          const migrated: CachedAuthState = {
            ...parsed,
            version: CACHE_VERSION,
            cachedAt: Date.now(),
          };
          memoryCache = migrated;
          localStorage.setItem(CACHE_KEY, JSON.stringify(migrated));
          // Clean up old keys
          sessionStorage.removeItem('auth_cache_v3');
          return migrated;
        }
      }
      return null;
    }
    
    const parsed = JSON.parse(cached) as CachedAuthState;
    
    if (!isCacheStructurallyValid(parsed)) {
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
 * Get cached license status (medium TTL for freshness)
 */
export const getCachedLicense = (): CachedAuthState | null => {
  if (memoryCache && isLicenseCacheValid(memoryCache)) {
    return memoryCache;
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
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
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    // localStorage might be full or unavailable
    logger.warn('Failed to persist auth cache', 'AuthCache');
  }
};

export const clearAuthCache = (): void => {
  memoryCache = null;
  try {
    localStorage.removeItem(CACHE_KEY);
    // Also clear old cache keys from both storages
    sessionStorage.removeItem('auth_cache_v1');
    sessionStorage.removeItem('auth_cache_v2');
    sessionStorage.removeItem('auth_cache_v3');
    localStorage.removeItem('auth_cache_v3');
  } catch {
    // Ignore
  }
};

export const validateCacheWithSession = (sessionUserId: string): boolean => {
  const cached = getCachedAuth();
  return cached?.userId === sessionUserId;
};
