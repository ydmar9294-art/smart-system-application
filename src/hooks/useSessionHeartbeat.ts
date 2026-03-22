/**
 * useSessionHeartbeat - Periodic session heartbeat (30s)
 * 
 * Updates last_active on the server and validates the session is still active.
 * If the server responds with session_invalid, fires device-revoked event
 * to trigger forced logout (stolen token protection).
 * 
 * On Capacitor: Pauses heartbeat when app is backgrounded, resumes on foreground.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { sendHeartbeat } from '@/lib/deviceService';
import { logger } from '@/lib/logger';

const HEARTBEAT_INTERVAL_MS = 90_000; // 90 seconds (optimized for scale: 30s was too aggressive at 25K+ users)

export function useSessionHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const revokedRef = useRef(false);

  const fireRevocation = useCallback((message?: string) => {
    if (revokedRef.current) return;
    revokedRef.current = true;
    logger.warn('Heartbeat detected session revocation', 'Heartbeat');
    window.dispatchEvent(
      new CustomEvent('device-revoked', {
        detail: { message: message || 'تم تسجيل الدخول إلى حسابك من جهاز آخر' },
      })
    );
  }, []);

  const doHeartbeat = useCallback(async () => {
    if (!isActiveRef.current || revokedRef.current) return;
    try {
      const result = await sendHeartbeat();
      if (!result.active) {
        fireRevocation(result.message);
      }
    } catch {
      // Network errors are OK — don't disrupt
    }
  }, [fireRevocation]);

  useEffect(() => {
    if (!userId) return;
    revokedRef.current = false;
    isActiveRef.current = true;

    // Start heartbeat interval
    intervalRef.current = setInterval(doHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Send initial heartbeat after 5s (give time for registration to complete)
    const initialTimeout = setTimeout(doHeartbeat, 5000);

    // Capacitor: pause/resume heartbeat on app state changes
    let appStateListener: { remove: () => void } | null = null;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        isActiveRef.current = isActive;
        if (isActive && !revokedRef.current) {
          // Resume: send immediate heartbeat
          doHeartbeat();
        }
      }).then(listener => {
        appStateListener = listener;
      });
    }

    // Web: pause when tab is hidden
    const handleVisibility = () => {
      isActiveRef.current = document.visibilityState === 'visible';
      if (isActiveRef.current && !revokedRef.current) {
        doHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearTimeout(initialTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [userId, doHeartbeat]);
}
