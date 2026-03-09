/**
 * Device Service
 * Client-side functions for registering and verifying device with the server.
 */
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getDeviceName, setDeviceVerified, clearDeviceVerification } from './deviceId';
import { logger } from './logger';

interface DeviceResponse {
  success: boolean;
  active?: boolean;
  status?: string;
  message?: string;
  replaced_device_id?: string;
  replaced_device_name?: string;
}

/**
 * Register the current device after successful login.
 * Returns info about whether a previous device was replaced.
 */
export async function registerDevice(): Promise<DeviceResponse> {
  try {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      return { success: false, status: 'NO_SESSION' };
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=register`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-device-id': deviceId,
        'x-device-name': deviceName,
      },
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
 */
export async function verifyDevice(): Promise<{ active: boolean; message?: string }> {
  try {
    const deviceId = getDeviceId();
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      return { active: true };
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-check?action=verify`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-device-id': deviceId,
      },
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

/** Clear device state on logout */
export function clearDeviceState(): void {
  clearDeviceVerification();
}
