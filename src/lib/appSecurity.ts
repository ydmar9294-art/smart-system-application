/**
 * APK Security Service
 * 
 * Provides client-side security checks for Capacitor Android APK.
 * See docs/android-security-plugin.md for native setup instructions.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SecurityCheckResult {
  isRooted: boolean;
  isSideloaded: boolean;
  isSignatureValid: boolean;
  screenshotBlocked: boolean;
  details: string[];
}

let cachedResult: SecurityCheckResult | null = null;

const AppSecurity = registerPlugin<any>('AppSecurity');

async function callNativePlugin(method: string): Promise<any> {
  try {
    if (!Capacitor.isPluginAvailable('AppSecurity')) {
      console.warn('[Security] AppSecurity plugin not available');
      return null;
    }
    return await AppSecurity[method]();
  } catch (e) {
    console.warn(`[Security] Plugin call failed (${method}):`, e);
    return null;
  }
}

export async function runSecurityChecks(): Promise<SecurityCheckResult> {
  if (cachedResult) return cachedResult;

  if (!Capacitor.isNativePlatform()) {
    cachedResult = {
      isRooted: false,
      isSideloaded: false,
      isSignatureValid: true,
      screenshotBlocked: false,
      details: ['Running in web browser — native checks skipped'],
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

  cachedResult = { isRooted, isSideloaded, isSignatureValid, screenshotBlocked, details };
  return cachedResult;
}

export function clearSecurityCache(): void {
  cachedResult = null;
}
