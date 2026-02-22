/**
 * Version Check Hook
 * Uses Capacitor App.getInfo() for native, or a fallback version for web.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { checkAppVersion, type VersionCheckResult, type UpdateStatus } from '@/lib/versionCheck';

const FALLBACK_VERSION = '1.0.0';

export function useVersionCheck() {
  const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const performCheck = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);

    try {
      let currentVersion = FALLBACK_VERSION;
      let platform = 'web';

      if (Capacitor.isNativePlatform()) {
        try {
          const info = await App.getInfo();
          currentVersion = info.version;
          platform = Capacitor.getPlatform(); // 'android' | 'ios'
        } catch {
          console.warn('[VersionCheck] Could not get native app info');
        }
      }

      const result = await checkAppVersion(currentVersion, platform);
      setCheckResult(result);
    } catch (err) {
      console.error('[VersionCheck] Check failed:', err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    performCheck();
  }, []);

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
