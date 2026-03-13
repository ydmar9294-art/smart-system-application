/**
 * Device Service v2
 * Client-side functions for registering, verifying, heartbeat, and session management.
 * Sends platform, app version, and device metadata on every request.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  getDeviceId,
  getDeviceName,
  getDevicePlatform,
  getAppVersion,
  setDeviceVerified,
  clearDeviceVerification,
} from './deviceId';
import { logger } from './logger';

interface DeviceResponse {
  success: boolean;
  active?: boolean;
  status?: string;
  message?: string;
  replaced_device_id?: string;
  replaced_device_name?: string;
}

interface PreCheckResponse {
  success: boolean;
  has_active_session: boolean;
  active_devices?: Array<{
    device_name: string;
    last_seen: string;
    platform?: string;
  }>;
}

/** Build common headers for all device-check requests */
function getDeviceHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'x-device-id': getDeviceId(),
    'x-device-name': getDeviceName(),
    'x-device-platform': getDevicePlatform(),
    'x-app-version': getAppVersion(),
  };
}

/** Get the current access token or null */
async function getAccessToken(): Promise<string | null> {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token || null;
}

/**
 * Pre-check: Does the user have an active session on another device?
 * Called AFTER successful auth but BEFORE device registration.
 */
export async function preCheckDevice(): Promise<PreCheckResponse> {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, has_active_session: false };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=pre-check`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getDeviceHeaders(token),
    });

    return await res.json();
  } catch (err) {
    logger.warn('Device pre-check failed (network?) — assuming no active session', 'Device');
    return { success: false, has_active_session: false };
  }
}

/**
 * Register the current device after successful login.
 * Returns info about whether a previous device was replaced.
 */
export async function registerDevice(): Promise<DeviceResponse> {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, status: 'NO_SESSION' };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=register`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getDeviceHeaders(token),
    });

    const result: DeviceResponse = await res.json();
    if (result.success) {
      setDeviceVerified();
      logger.info(`Device registered: ${result.status}`, 'Device');
    }
    return result;
  } catch (err) {
    logger.error('Device registration failed', 'Device', { error: String(err) });
    return { success: false, status: 'ERROR' };
  }
}

/**
 * Verify the current device is still active.
 * Used for API-level session validation.
 */
export async function verifyDevice(): Promise<{ active: boolean; message?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) return { active: true };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=verify`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getDeviceHeaders(token),
    });

    const result: DeviceResponse = await res.json();

    if (result.success && result.active) {
      setDeviceVerified();
      return { active: true };
    }

    if (result.success && result.active === false) {
      return { active: false, message: result.message || 'تم تسجيل الدخول من جهاز آخر' };
    }

    return { active: true };
  } catch (err) {
    logger.warn('Device verification failed (network?) — assuming active', 'Device');
    return { active: true };
  }
}

/**
 * Heartbeat — update last_active timestamp.
 * Returns false if the session has been revoked (stolen token protection).
 */
export async function sendHeartbeat(): Promise<{ active: boolean; message?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) return { active: true }; // No session yet

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=heartbeat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-device-id': getDeviceId(),
      },
    });

    const result = await res.json();

    if (result.success && result.active === false) {
      return { active: false, message: result.message || 'تم تسجيل الدخول من جهاز آخر' };
    }

    if (result.success && result.active) {
      setDeviceVerified();
    }

    return { active: true };
  } catch {
    // Network error — don't disrupt the user
    return { active: true };
  }
}

/**
 * Notify server of logout (marks device inactive + logs security event).
 */
export async function notifyLogout(): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=logout`;
    await fetch(url, {
      method: 'POST',
      headers: getDeviceHeaders(token),
    });
  } catch {
    // Best-effort — don't block logout
  }
}

/** Clear device state on logout */
export function clearDeviceState(): void {
  clearDeviceVerification();
}
