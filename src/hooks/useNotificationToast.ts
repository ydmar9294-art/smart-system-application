/**
 * useNotificationToast - listens to user_notifications realtime inserts
 * and shows toasts via the global notification system.
 *
 * Used by distributors so price/exchange-rate changes pop up immediately.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { logger } from '@/lib/logger';

export function useNotificationToast(userId?: string | null) {
  const { addNotification } = useApp();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;

          // Map server type → toast severity
          let severity: 'info' | 'success' | 'warning' | 'error' = 'info';
          if (row.type === 'price_change' || row.type === 'exchange_rate_change') severity = 'warning';
          if (row.type === 'success') severity = 'success';
          if (row.type === 'error') severity = 'error';

          try {
            addNotification(severity, row.title || 'إشعار جديد', row.description || '');
          } catch (e) {
            logger.warn('[useNotificationToast] Failed to display', 'useNotificationToast');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, addNotification]);
}

export default useNotificationToast;
