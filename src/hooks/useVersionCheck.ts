/**
 * Version Check Hook
 * Checks version on: initial load, app resume from background, login.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { checkAppVersion, type VersionCheckResult } from '@/lib/versionCheck';

const FALLBACK_VERSION = '1.0';

export function useVersionCheck() {
  const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isCheckingRef = useRef(false);

  const performCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      let currentVersion = FALLBACK_VERSION;
      let platform = 'web';

      if (Capacitor.isNativePlatform()) {
        try {
          const info = await App.getInfo();
          currentVersion = info.version;
          platform = Capacitor.getPlatform();
        } catch {
          console.warn('[VersionCheck] Could not get native app info');
        }
      }

      const result = await checkAppVersion(currentVersion, platform);
      setCheckResult(result);

      // If force update detected, reset dismiss state
      if (result.status === 'force_update') {
        setDismissed(false);
      }
    } catch (err) {
      console.error('[VersionCheck] Check failed:', err);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  // Check on mount (deferred)
  useEffect(() => {
    const timer = setTimeout(performCheck, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Check on app resume from background (native only)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any;
    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        // App came back to foreground, re-check version
        performCheck();
      }
    }).then(l => { listener = l; });

    return () => {
      if (listener) listener.remove();
    };
  }, [performCheck]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const showUpdateModal =
    !dismissed &&
    checkResult != null &&
    (checkResult.status === 'force_update' || checkResult.status === 'optional_update');

  const isForceUpdate = checkResult?.status === 'force_update';

  return {
    checkResult,
    isChecking,
    showUpdateModal,
    isForceUpdate,
    dismiss,
    recheck: performCheck,
  };
}
