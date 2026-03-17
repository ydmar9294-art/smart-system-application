/**
 * useGpsTracker — Captures GPS location for distributor visits
 * Works with @capacitor/geolocation on native, falls back to browser Geolocation API.
 * Stores offline and syncs via useOfflineMutationQueue.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { withOfflineQueue } from '@/hooks/data/useOfflineMutationQueue';

interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface RecordLocationParams {
  userId: string;
  orgId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  visitType: 'customer_visit' | 'route_point' | 'check_in';
  customerId?: string;
  notes?: string;
}

// Service function for offline queue
async function recordLocationService(params: RecordLocationParams): Promise<void> {
  const { error } = await supabase.from('distributor_locations').insert({
    user_id: params.userId,
    organization_id: params.orgId,
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy,
    visit_type: params.visitType,
    customer_id: params.customerId || null,
    notes: params.notes || null,
    is_synced: true,
    recorded_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  });
  if (error) throw error;
}

const queuedRecordLocation = withOfflineQueue('gpsTracker.recordLocation', recordLocationService);

export function useGpsTracker() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPosition, setLastPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback(async (): Promise<GpsPosition> => {
    // Try Capacitor Geolocation first
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch {
      // Fallback to browser API
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
    }
  }, []);

  const captureLocation = useCallback(async (
    userId: string,
    orgId: string,
    visitType: 'customer_visit' | 'route_point' | 'check_in',
    customerId?: string,
    notes?: string,
  ): Promise<GpsPosition | null> => {
    setIsCapturing(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      setLastPosition(position);

      await queuedRecordLocation({
        userId,
        orgId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        visitType,
        customerId,
        notes,
      });

      logger.info(`[GPS] Recorded ${visitType} at ${position.latitude},${position.longitude}`, 'GpsTracker');
      return position;
    } catch (err: any) {
      const msg = err.message || 'GPS capture failed';
      setError(msg);
      logger.warn(`[GPS] ${msg}`, 'GpsTracker');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [getCurrentPosition]);

  return {
    captureLocation,
    isCapturing,
    lastPosition,
    error,
  };
}
