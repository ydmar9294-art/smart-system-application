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

          // Map server type → toast severity (NotificationContext supports: success | error | warning)
          let severity: 'success' | 'error' | 'warning' = 'warning';
          if (row.type === 'success') severity = 'success';
          else if (row.type === 'error') severity = 'error';

          try {
            const message = row.title
              ? (row.description ? `${row.title} — ${row.description}` : row.title)
              : (row.description || 'إشعار جديد');
            addNotification(message, severity);
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
