/**
 * Capacitor OAuth Deep Link Handler
 * 
 * Handles the return flow from Google OAuth on native platforms:
 * 1. Listens for deep links (smartsystem://oauth-callback#access_token=...)
 * 2. Extracts tokens from the URL fragment
 * 3. Sets the Supabase session using the tokens
 * 4. Listens for browser close events to check session
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';

let isInitialized = false;

/**
 * Parse tokens from a URL fragment like:
 * #access_token=xxx&refresh_token=yyy&type=oauth
 */
function parseTokensFromFragment(fragment: string): { accessToken: string; refreshToken: string } | null {
  const clean = fragment.startsWith('#') ? fragment.substring(1) : fragment;
  const params = new URLSearchParams(clean);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  
  if (!accessToken) return null;
  return { accessToken, refreshToken: refreshToken || '' };
}

/**
 * Set Supabase session from OAuth tokens received via deep link
 */
async function handleOAuthTokens(accessToken: string, refreshToken: string): Promise<boolean> {
  try {
    console.log('[CapacitorOAuth] Setting session from deep link tokens');
    
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[CapacitorOAuth] Failed to set session:', error.message);
      return false;
    }

    console.log('[CapacitorOAuth] Session set successfully for user:', data.user?.id);
    
    // Close the browser tab that was used for OAuth
    try {
      await Browser.close();
    } catch {
      // Browser might already be closed
    }
    
    return true;
  } catch (err) {
    console.error('[CapacitorOAuth] Error setting session:', err);
    return false;
  }
}

/**
 * Initialize Capacitor OAuth listeners.
 * Call this once at app startup (main.tsx).
 * Only activates on native platforms (Android/iOS).
 */
export function initCapacitorOAuth(): void {
  if (isInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  
  isInitialized = true;
  console.log('[CapacitorOAuth] Initializing deep link listeners');

  // ── Deep Link Listener ──
  // Catches: smartsystem://oauth-callback#access_token=...
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    console.log('[CapacitorOAuth] Deep link received:', url);

    if (!url.includes('oauth-callback')) return;

    // Extract fragment from URL
    const fragmentIndex = url.indexOf('#');
    if (fragmentIndex === -1) return;

    const fragment = url.substring(fragmentIndex);
    const tokens = parseTokensFromFragment(fragment);
    
    if (!tokens) {
      console.warn('[CapacitorOAuth] No tokens found in deep link');
      return;
    }

    await handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
  });

  // ── Browser Finished Listener ──
  // If user closes the browser manually, check if session was already established
  Browser.addListener('browserFinished', async () => {
    console.log('[CapacitorOAuth] Browser closed, checking session...');
    
    // Small delay to let any pending auth state changes propagate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[CapacitorOAuth] Session found after browser close');
      // Session exists — onAuthStateChange will handle the rest
    } else {
      console.log('[CapacitorOAuth] No session after browser close');
    }
  });

  // ── Handle tokens in the initial URL (app opened via deep link while closed) ──
  CapApp.getLaunchUrl().then(result => {
    if (!result?.url) return;
    if (!result.url.includes('oauth-callback')) return;
    
    const fragmentIndex = result.url.indexOf('#');
    if (fragmentIndex === -1) return;

    const fragment = result.url.substring(fragmentIndex);
    const tokens = parseTokensFromFragment(fragment);
    
    if (tokens) {
      console.log('[CapacitorOAuth] Found tokens in launch URL');
      handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
    }
  });
}
