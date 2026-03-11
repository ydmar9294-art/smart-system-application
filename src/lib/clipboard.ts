/**
 * Cross-platform clipboard utility.
 * Uses Capacitor Clipboard on native, falls back to navigator.clipboard on web.
 */
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

export async function copyToClipboard(text: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({ string: text });
      return true;
    } catch (e) {
      console.error('Native clipboard error:', e);
      return fallbackCopy(text);
    }
  }

  // Web: try navigator.clipboard first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }

  return fallbackCopy(text);
}

/** Fallback using execCommand for older browsers / insecure contexts */
function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
