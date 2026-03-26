/**
 * GPS Tracker Hook
 * 
 * Interval-based location tracking for FIELD_AGENT distributors.
 * Uses @capacitor/geolocation on native, navigator.geolocation on web.
 * Stores locations in offline queue as GPS_LOG type for batch sync.
 * Battery-optimized: configurable interval, pauses when backgrounded.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

interface GpsTrackerOptions {
  /** Tracking interval in milliseconds (default: 3 min) */
  intervalMs?: number;
  /** Whether tracking is enabled */
  enabled?: boolean;
  /** Organization ID for location records */
  organizationId?: string;
}

interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export function useGpsTracker(options: GpsTrackerOptions = {}) {
  const { intervalMs = 3 * 60 * 1000, enabled = false, organizationId } = options;
  const [lastPosition, setLastPosition] = useState<GpsPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const capturePosition = useCallback(async () => {
    if (!isMountedRef.current || !organizationId) return;

    try {
      let position: GpsPosition;

      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const result = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
        });
        position = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          timestamp: result.timestamp,
        };
      } else {
        // Web fallback
        position = await new Promise<GpsPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
          );
        });
      }

      if (!isMountedRef.current) return;
      setLastPosition(position);
      setError(null);

      // Enqueue GPS log to offline queue
      try {
        const { enqueueAction } = await import(
          '@/features/distributor/services/distributorOfflineService'
        );
        await enqueueAction('GPS_LOG', {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          recordedAt: new Date(position.timestamp).toISOString(),
          organizationId,
          visitType: 'route_point',
        });
      } catch (queueErr) {
        logger.warn('Failed to enqueue GPS log', 'GpsTracker');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const msg = err?.message || 'GPS error';
      setError(msg);
      logger.warn(`GPS capture failed: ${msg}`, 'GpsTracker');
    }
  }, [organizationId]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !organizationId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsTracking(false);
      return;
    }

    // Initial capture
    capturePosition();
    setIsTracking(true);

    // Interval-based tracking
    intervalRef.current = setInterval(capturePosition, intervalMs);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsTracking(false);
    };
  }, [enabled, intervalMs, organizationId, capturePosition]);

  return {
    lastPosition,
    isTracking,
    error,
    captureNow: capturePosition,
  };
}
