/**
 * APK Security Service
 * 
 * Provides client-side security checks for Capacitor Android APK.
 * See docs/android-security-plugin.md for native setup instructions.
 * 
 * Security checks are re-evaluated periodically (every 30 minutes)
 * to detect runtime state changes (e.g. device rooted after launch).
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { logger } from '@/lib/logger';

export interface SecurityCheckResult {
  isRooted: boolean;
  isSideloaded: boolean;
  isSignatureValid: boolean;
  screenshotBlocked: boolean;
  details: string[];
  checkedAt: number;
}

let cachedResult: SecurityCheckResult | null = null;

/** Re-check interval: 30 minutes */
const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

const AppSecurity = registerPlugin<any>('AppSecurity');

async function callNativePlugin(method: string): Promise<any> {
  try {
    if (!Capacitor.isPluginAvailable('AppSecurity')) {
      logger.warn('AppSecurity plugin not available', 'Security');
      return null;
    }
    return await AppSecurity[method]();
  } catch (e) {
    logger.warn(`Plugin call failed (${method})`, 'Security');
    return null;
  }
}

function isCacheExpired(): boolean {
  if (!cachedResult) return true;
  return Date.now() - cachedResult.checkedAt > RECHECK_INTERVAL_MS;
}

export async function runSecurityChecks(forceRefresh = false): Promise<SecurityCheckResult> {
  if (cachedResult && !forceRefresh && !isCacheExpired()) return cachedResult;

  if (!Capacitor.isNativePlatform()) {
    cachedResult = {
      isRooted: false,
      isSideloaded: false,
      isSignatureValid: true,
      screenshotBlocked: false,
      details: ['Running in web browser — native checks skipped'],
      checkedAt: Date.now(),
    };
    return cachedResult;
  }

  const details: string[] = [];

  const screenshotResult = await callNativePlugin('blockScreenshots');
  const screenshotBlocked = screenshotResult?.blocked === true;
  details.push(screenshotBlocked ? '✓ Screenshots blocked' : '⚠ Screenshot blocking unavailable');

  const rootResult = await callNativePlugin('checkRoot');
  const isRooted = rootResult?.isRooted === true;
  details.push(isRooted ? '⚠ ROOTED DEVICE DETECTED' : '✓ Device not rooted');

  const sideloadResult = await callNativePlugin('checkInstaller');
  const isSideloaded = sideloadResult?.isSideloaded === true;
  if (sideloadResult?.installer) {
    details.push(`Installer: ${sideloadResult.installer}`);
  }
  details.push(isSideloaded ? '⚠ APK SIDE-LOADED' : '✓ Installed from official store');

  const sigResult = await callNativePlugin('verifySignature');
  const isSignatureValid = sigResult?.isValid !== false;
  details.push(isSignatureValid ? '✓ APK signature valid' : '⚠ APK SIGNATURE MISMATCH');

  cachedResult = { isRooted, isSideloaded, isSignatureValid, screenshotBlocked, details, checkedAt: Date.now() };
  
  if (isRooted || isSideloaded || !isSignatureValid) {
    logger.warn('Security check flagged issues', 'Security', {
      isRooted, isSideloaded, isSignatureValid,
    });
  }
  
  return cachedResult;
}

export function clearSecurityCache(): void {
  cachedResult = null;
}
