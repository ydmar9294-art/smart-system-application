/**
 * Device ID Management
 * Generates a persistent, unique device identifier stored in localStorage.
 * Falls back to a generated UUID if no prior ID exists.
 */
import { generateUUID } from './uuid';

const DEVICE_ID_KEY = 'app_device_id';
const DEVICE_VERIFIED_KEY = 'app_device_last_verified';

/** Get or create a persistent device ID */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Get a human-readable device name */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
}

/** Record timestamp of last successful device verification */
export function setDeviceVerified(): void {
  localStorage.setItem(DEVICE_VERIFIED_KEY, Date.now().toString());
}

/** Get timestamp of last successful verification */
export function getLastDeviceVerified(): number | null {
  const ts = localStorage.getItem(DEVICE_VERIFIED_KEY);
  return ts ? parseInt(ts, 10) : null;
}

/** Clear device verification state (on logout) */
export function clearDeviceVerification(): void {
  localStorage.removeItem(DEVICE_VERIFIED_KEY);
}
