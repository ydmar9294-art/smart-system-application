/**
 * Auth Cache - Dual-layer caching (sessionStorage + memory)
 * 
 * Memory cache: instant access (0ms)
 * sessionStorage: survives page refreshes within tab
 * TTL: 30 minutes (increased from 15 for high-load stability)
 */

import { UserRole, EmployeeType, LicenseStatus } from '@/types';

const CACHE_KEY = 'auth_cache_v1';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

export const isCacheValid = (cache: CachedAuthState | null): boolean => {
  if (!cache) return false;
  if (cache.version !== CACHE_VERSION) return false;
  const age = Date.now() - cache.cachedAt;
  return age < CACHE_TTL_MS;
};

export const getCachedAuth = (): CachedAuthState | null => {
  // Memory cache first (instant)
  if (memoryCache && isCacheValid(memoryCache)) {
    return memoryCache;
  }
  
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached) as CachedAuthState;
    
    if (!isCacheValid(parsed)) {
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
  } catch {
    // Ignore
  }
};

export const validateCacheWithSession = (sessionUserId: string): boolean => {
  const cached = getCachedAuth();
  return cached?.userId === sessionUserId;
};