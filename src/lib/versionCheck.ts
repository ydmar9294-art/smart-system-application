/**
 * Version Check Service
 * Compares local app version with server version using semantic versioning.
 */



export interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  minRequiredVersion: string;
  forceUpdate: boolean;
  updateUrl: string;
  releaseNotes: string;
}

export type UpdateStatus = 'up_to_date' | 'optional_update' | 'force_update' | 'offline' | 'error';

export interface VersionCheckResult {
  status: UpdateStatus;
  versionInfo?: VersionInfo;
  currentVersion?: string;
}

// ============================================
// Semantic Version Comparison
// ============================================

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Returns:
 * -1 if a < b
 *  0 if a === b
 *  1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

// ============================================
// Version Check
// ============================================

export async function checkAppVersion(
  currentVersion: string,
  platform: string = 'android'
): Promise<VersionCheckResult> {
  if (!navigator.onLine) {
    return { status: 'offline', currentVersion };
  }

  try {
    // Direct fetch with query params
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const response = await fetch(
      `${projectUrl}/functions/v1/app-version?platform=${encodeURIComponent(platform)}`,
      {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // No version configured yet
        return { status: 'up_to_date', currentVersion };
      }
      throw new Error(`Version check failed: ${response.status}`);
    }

    const versionInfo: VersionInfo = await response.json();

    // Check if force update needed
    if (compareVersions(currentVersion, versionInfo.minRequiredVersion) < 0) {
      return { status: 'force_update', versionInfo, currentVersion };
    }

    // Check if optional update available
    if (compareVersions(currentVersion, versionInfo.latestVersion) < 0) {
      return { status: 'optional_update', versionInfo, currentVersion };
    }

    return { status: 'up_to_date', versionInfo, currentVersion };
  } catch (err) {
    console.error('[VersionCheck] Error:', err);
    return { status: 'error', currentVersion };
  }
}
