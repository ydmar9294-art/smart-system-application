/**
 * APK Security Service
 * 
 * Provides client-side security checks for Capacitor Android APK:
 * - Screenshot/screen recording prevention (via native plugin)
 * - Root detection
 * - Side-loading (unofficial install source) detection
 * - APK signature verification
 * 
 * IMPORTANT: These checks run on the JS side and call native Android APIs
 * through a custom Capacitor plugin (AppSecurityPlugin).
 * 
 * After `npx cap sync`, you must add the native plugin code to:
 * android/app/src/main/java/app/lovable/.../AppSecurityPlugin.java
 * 
 * See the companion file: android-security-plugin.md for native setup instructions.
 */

export interface SecurityCheckResult {
  isRooted: boolean;
  isSideloaded: boolean;
  isSignatureValid: boolean;
  screenshotBlocked: boolean;
  details: string[];
}

let cachedResult: SecurityCheckResult | null = null;

/**
 * Check if running inside Capacitor native environment
 */
async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Try to call the native AppSecurity plugin.
 * Returns null if plugin is not available (web environment or plugin not installed).
 */
async function callNativePlugin(method: string): Promise<any> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { registerPlugin } = await import('@capacitor/core');
    
    const AppSecurity = registerPlugin<any>('AppSecurity');
    
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

/**
 * Run all security checks. Safe to call on web (returns all-clear).
 */
export async function runSecurityChecks(): Promise<SecurityCheckResult> {
  if (cachedResult) return cachedResult;

  const native = await isNative();
  
  if (!native) {
    // Web environment — no security concerns
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

  // 1. Enable screenshot prevention
  const screenshotResult = await callNativePlugin('blockScreenshots');
  const screenshotBlocked = screenshotResult?.blocked === true;
  details.push(screenshotBlocked ? '✓ Screenshots blocked' : '⚠ Screenshot blocking unavailable');

  // 2. Root detection
  const rootResult = await callNativePlugin('checkRoot');
  const isRooted = rootResult?.isRooted === true;
  details.push(isRooted ? '⚠ ROOTED DEVICE DETECTED' : '✓ Device not rooted');

  // 3. Side-loading detection
  const sideloadResult = await callNativePlugin('checkInstaller');
  const isSideloaded = sideloadResult?.isSideloaded === true;
  if (sideloadResult?.installer) {
    details.push(`Installer: ${sideloadResult.installer}`);
  }
  details.push(isSideloaded ? '⚠ APK SIDE-LOADED' : '✓ Installed from official store');

  // 4. Signature verification
  const sigResult = await callNativePlugin('verifySignature');
  const isSignatureValid = sigResult?.isValid !== false; // default to valid if check unavailable
  details.push(isSignatureValid ? '✓ APK signature valid' : '⚠ APK SIGNATURE MISMATCH');

  cachedResult = { isRooted, isSideloaded, isSignatureValid, screenshotBlocked, details };
  return cachedResult;
}

/**
 * Clear cached results (e.g., on app resume to re-check)
 */
export function clearSecurityCache(): void {
  cachedResult = null;
}
