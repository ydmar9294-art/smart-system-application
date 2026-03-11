/**
 * Device ID Management
 * Generates a persistent, unique device identifier stored in localStorage.
 * On Capacitor, uses @capacitor/device for richer device names.
 */
import { Capacitor } from '@capacitor/core';
import { generateUUID } from './uuid';

const DEVICE_ID_KEY = 'app_device_id';
const DEVICE_VERIFIED_KEY = 'app_device_last_verified';
const DEVICE_NAME_KEY = 'app_device_name_cached';

/** Get or create a persistent device ID */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Get a human-readable device name.
 * On Capacitor, resolves the actual model name asynchronously and caches it.
 * Falls back to a synchronous UA-based name.
 */
export function getDeviceName(): string {
  // Return cached native name if available
  const cached = localStorage.getItem(DEVICE_NAME_KEY);
  if (cached) return cached;

  // Fallback: user-agent based
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
}

/**
 * Resolve and cache the native device model name.
 * Call once at startup on Capacitor to populate the cache.
 */
export async function resolveNativeDeviceName(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    // e.g. "Samsung Galaxy S24" or "iPhone 15 Pro"
    const name = info.model
      ? `${info.manufacturer || ''} ${info.model}`.trim()
      : (info.platform === 'android' ? 'Android' : 'iOS');
    localStorage.setItem(DEVICE_NAME_KEY, name);
  } catch {
    // Fallback already handled by getDeviceName()
  }
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
