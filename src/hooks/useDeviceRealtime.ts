/**
 * useDeviceRealtime - Real-time device session monitoring (WhatsApp-style)
 * Subscribes to Supabase Realtime on the devices table to instantly detect
 * when the current device's session is revoked by a new login elsewhere.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceId';
import { logger } from '@/lib/logger';

export function useDeviceRealtime(userId: string | undefined) {
  const dispatched = useRef(false);

  useEffect(() => {
    if (!userId) return;
    dispatched.current = false;

    const deviceId = getDeviceId();

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
          // If THIS device was deactivated, fire revocation event
          if (row.device_id === deviceId && row.is_active === false && !dispatched.current) {
            dispatched.current = true;
            logger.warn('Realtime: device deactivated — forcing logout', 'Device');
            window.dispatchEvent(
              new CustomEvent('device-revoked', {
                detail: { message: 'تم تسجيل الدخول إلى حسابك من جهاز آخر' },
              })
            );
          }
        }
      )
      .subscribe((status) => {
        logger.info(`Device realtime channel: ${status}`, 'Device');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
