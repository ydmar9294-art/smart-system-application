/**
 * Version Check Service
 * Compares local app version with server version.
 * Supports both X.X and X.X.X formats.
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
// Semantic Version Comparison (supports X.X and X.X.X)
// ============================================

function parseVersion(version: string): number[] {
  return version.split('.').map(Number);
}

/**
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const av = aParts[i] || 0;
    const bv = bParts[i] || 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
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
    logger.error('Version check error', 'VersionCheck');
    return { status: 'error', currentVersion };
  }
}
