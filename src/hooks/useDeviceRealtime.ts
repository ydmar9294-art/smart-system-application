/**
 * useDeviceRealtime - Real-time device session monitoring (WhatsApp-style)
 * 
 * Subscribes to Supabase Realtime on the devices table to instantly detect
 * when the current device's session is revoked by a new login elsewhere.
 * 
 * On Capacitor: Also listens for appStateChange to verify device and
 * reconnect the Realtime channel after the app returns from background.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceId';
import { verifyDevice } from '@/lib/deviceService';
import { logger } from '@/lib/logger';

export function useDeviceRealtime(userId: string | undefined) {
  const dispatched = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fireRevocation = useCallback((message?: string) => {
    if (dispatched.current) return;
    dispatched.current = true;
    logger.warn('Device revoked — forcing logout', 'Device');
    window.dispatchEvent(
      new CustomEvent('device-revoked', {
        detail: { message: message || 'تم تسجيل الدخول إلى حسابك من جهاز آخر' },
      })
    );
  }, []);

  useEffect(() => {
    if (!userId) return;
    dispatched.current = false;

    const deviceId = getDeviceId();

    // ── Subscribe to Realtime ──
    const subscribe = () => {
      // Clean up previous channel if exists
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`device-watch-${userId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'devices',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (row.device_id === deviceId && row.is_active === false) {
              fireRevocation();
            }
          }
        )
        .subscribe((status) => {
          logger.info(`Device realtime channel: ${status}`, 'Device');
        });

      channelRef.current = channel;
    };

    subscribe();

    // ── Capacitor: Verify device on app resume (WebSocket may have dropped) ──
    let appStateListener: { remove: () => void } | null = null;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive || dispatched.current) return;

        logger.info('App resumed — verifying device session', 'Device');

        // Re-subscribe Realtime (channel likely dropped during background)
        subscribe();

        // Also verify via API as a safety net
        try {
          const result = await verifyDevice();
          if (!result.active) {
            fireRevocation(result.message);
          }
        } catch {
          // Network may not be ready yet — ignore
        }
      }).then(listener => {
        appStateListener = listener;
      });
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [userId, fireRevocation]);
}
