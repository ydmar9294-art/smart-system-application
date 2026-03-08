/**
 * Performance Monitor - Lightweight production monitoring
 * Tracks slow queries, failed RPCs, WebSocket reconnects, sync failures
 */
import { logger } from '@/lib/logger';

const SLOW_THRESHOLD_MS = 3000;

interface MetricEntry {
  label: string;
  durationMs: number;
  timestamp: number;
}

const metricsBuffer: MetricEntry[] = [];
const MAX_BUFFER = 200;

export const performanceMonitor = {
  /** Start a timer, returns a function that stops it and logs if slow */
  startTimer(label: string): () => number {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      const entry: MetricEntry = { label, durationMs: duration, timestamp: Date.now() };

      metricsBuffer.push(entry);
      if (metricsBuffer.length > MAX_BUFFER) metricsBuffer.shift();

      if (duration > SLOW_THRESHOLD_MS) {
        logger.warn(`[Perf] Slow operation: ${label} took ${duration}ms`, 'Performance', { durationMs: duration } as any);
      }
      return duration;
    };
  },

  /** Record a failure event */
  recordFailure(label: string, error: string, context?: Record<string, unknown>) {
    logger.error(`[Monitor] ${label}: ${error}`, 'Monitor', context);
  },

  /** Record WebSocket reconnect attempt */
  recordReconnect(channel: string, attempt: number) {
    logger.warn(`[Monitor] WS reconnect: ${channel} attempt #${attempt}`, 'WebSocket', { channel, attempt } as any);
  },

  /** Record sync failure */
  recordSyncFailure(operation: string, error: string) {
    logger.error(`[Monitor] Sync failed: ${operation} - ${error}`, 'Sync');
  },

  /** Get recent metrics for debugging */
  getMetrics(): ReadonlyArray<MetricEntry> {
    return [...metricsBuffer];
  },

  /** Get slow operations only */
  getSlowOperations(): MetricEntry[] {
    return metricsBuffer.filter(m => m.durationMs > SLOW_THRESHOLD_MS);
  },
};
