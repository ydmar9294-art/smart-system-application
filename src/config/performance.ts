/**
 * Performance Feature Flags
 * Toggle individual optimizations for safe rollout/rollback.
 */
export const PERF_FLAGS = {
  /** Offload AES-GCM encrypt/decrypt to a Web Worker */
  USE_CRYPTO_WORKER: true,
  /** Use CSS transitions instead of framer-motion in AnimatedTabContent */
  LAZY_FRAMER_MOTION: true,
  /** Load only the active language at boot (dynamic import) */
  SPLIT_I18N: true,
  /** Throttle SecurityGate resume checks to once per 5 minutes */
  DEFER_SECURITY_CHECK: true,
  /** Use IDB index for faster cache cleanup */
  IDB_INDEX: true,
  /** Skip encryption for non-sensitive cache keys */
  SKIP_NONSENSITIVE_ENCRYPTION: true,
} as const;

/**
 * Query keys that contain non-sensitive data — safe to store unencrypted.
 * Financial data (sales, payments, invoices, collections) is always encrypted.
 */
export const UNENCRYPTED_CACHE_KEYS = [
  'products',
  'categories',
  'price_list',
  'regions',
  'warehouses',
  'distributorInventory',
  'pendingEmployees',
  'deliveries',
  'users',
  'orgStats',
] as const;

/**
 * Check if a query key represents non-sensitive data.
 */
export function isNonSensitiveKey(queryKey: readonly unknown[]): boolean {
  if (!PERF_FLAGS.SKIP_NONSENSITIVE_ENCRYPTION) return false;
  const keyStr = JSON.stringify(queryKey).toLowerCase();
  return UNENCRYPTED_CACHE_KEYS.some(k => keyStr.includes(k.toLowerCase()));
}
