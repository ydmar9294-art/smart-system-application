/**
 * Storage Monitor
 * 
 * Monitors IndexedDB usage and provides alerts when storage limits are approached.
 * Tracks storage health for offline-first systems.
 */

import { logger } from './logger';

// ============================================
// Constants
// ============================================

/** Warn when usage exceeds 80% of quota */
const WARNING_THRESHOLD = 0.8;
/** Critical when usage exceeds 90% of quota */
const CRITICAL_THRESHOLD = 0.9;
/** Maximum safe offline data target: ~50MB */
const MAX_SAFE_BYTES = 50 * 1024 * 1024;

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number;
  isWarning: boolean;
  isCritical: boolean;
  formattedUsage: string;
  formattedQuota: string;
}

// ============================================
// Storage Estimation
// ============================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get current storage usage estimate.
 * Uses navigator.storage.estimate() when available.
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    if (!navigator.storage?.estimate) {
      return null;
    }

    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const usagePercent = quota > 0 ? usage / quota : 0;

    return {
      usageBytes: usage,
      quotaBytes: quota,
      usagePercent,
      isWarning: usagePercent >= WARNING_THRESHOLD || usage >= MAX_SAFE_BYTES * WARNING_THRESHOLD,
      isCritical: usagePercent >= CRITICAL_THRESHOLD || usage >= MAX_SAFE_BYTES * CRITICAL_THRESHOLD,
      formattedUsage: formatBytes(usage),
      formattedQuota: formatBytes(quota),
    };
  } catch {
    return null;
  }
}

/**
 * Log storage status. Call periodically or after large writes.
 */
export async function logStorageHealth(): Promise<void> {
  const estimate = await getStorageEstimate();
  if (!estimate) return;

  const { formattedUsage, formattedQuota, usagePercent, isWarning, isCritical } = estimate;
  const pct = (usagePercent * 100).toFixed(1);

  if (isCritical) {
    logger.error(`[Storage] CRITICAL: ${formattedUsage} / ${formattedQuota} (${pct}%) — approaching limit`, 'StorageMonitor');
  } else if (isWarning) {
    logger.warn(`[Storage] WARNING: ${formattedUsage} / ${formattedQuota} (${pct}%)`, 'StorageMonitor');
  } else {
    logger.info(`[Storage] OK: ${formattedUsage} / ${formattedQuota} (${pct}%)`, 'StorageMonitor');
  }
}

/**
 * Request persistent storage to prevent eviction (Capacitor/PWA).
 * Returns true if granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      if (granted) {
        logger.info('[Storage] Persistent storage granted', 'StorageMonitor');
      } else {
        logger.warn('[Storage] Persistent storage denied — data may be evicted under pressure', 'StorageMonitor');
      }
      return granted;
    }
  } catch {
    // Not supported
  }
  return false;
}

/**
 * Check if we're approaching storage limits before a large write.
 * Returns false if the write should be blocked.
 */
export async function canSafelyWrite(estimatedBytes: number = 0): Promise<boolean> {
  const estimate = await getStorageEstimate();
  if (!estimate) return true; // Can't measure, allow the write

  if (estimate.isCritical) {
    logger.error('[Storage] Write blocked — storage critically full', 'StorageMonitor');
    return false;
  }

  if (estimatedBytes > 0 && estimate.quotaBytes > 0) {
    const projectedUsage = estimate.usageBytes + estimatedBytes;
    if (projectedUsage / estimate.quotaBytes >= CRITICAL_THRESHOLD) {
      logger.warn('[Storage] Write may exceed safe limits', 'StorageMonitor');
      return false;
    }
  }

  return true;
}
