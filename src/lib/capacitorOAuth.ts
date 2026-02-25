/**
 * Capacitor Deep Link Handler
 * 
 * Handles deep links for OAuth, password reset, and email confirmation on native platforms:
 * 1. OAuth: myapp://auth/oauth-callback#access_token=...
 * 2. Reset Password: myapp://auth/reset-password#access_token=...&type=recovery
 * 3. Email Confirmed: myapp://auth/email-confirmed#access_token=...&type=signup
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { clearOAuthPending } from '@/lib/oauthState';

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
    // Close the browser FIRST for perceived speed — user sees the app instantly
    try {
      await Browser.close();
    } catch {
      // Browser might already be closed
    }

    console.log('[CapacitorDeepLink] Setting session from deep link tokens');
    
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[CapacitorDeepLink] Failed to set session:', error.message);
      return false;
    }

    console.log('[CapacitorDeepLink] Session set successfully for user:', data.user?.id);
    return true;
  } catch (err) {
    console.error('[CapacitorDeepLink] Error setting session:', err);
    return false;
  }
}

/**
 * Initialize Capacitor deep link listeners.
 * Call this once at app startup (main.tsx).
 * Only activates on native platforms (Android/iOS).
 */
export function initCapacitorOAuth(): void {
  if (isInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  
  isInitialized = true;
  console.log('[CapacitorDeepLink] Initializing deep link listeners');

  // ── Deep Link Listener ──
  // Catches: myapp://auth/oauth-callback, myapp://auth/reset-password, myapp://auth/email-confirmed
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    console.log('[CapacitorDeepLink] Deep link received:', url);

    const fragmentIndex = url.indexOf('#');
    const fragment = fragmentIndex !== -1 ? url.substring(fragmentIndex) : '';
    const tokens = fragment ? parseTokensFromFragment(fragment) : null;

    // ── OAuth Callback ──
    if (url.includes('oauth-callback')) {
      clearOAuthPending();
      if (!tokens) {
        console.warn('[CapacitorDeepLink] No tokens found in OAuth deep link');
        return;
      }
      await handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
      return;
    }

    // ── Reset Password ──
    if (url.includes('reset-password')) {
      if (tokens) {
        // Set the recovery session so updateUser works on /reset-password page
        await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        try { await Browser.close(); } catch {}
      }
      // Navigate to reset password page (HashRouter)
      window.location.hash = '#/reset-password';
      return;
    }

    // ── Email Confirmed ──
    if (url.includes('email-confirmed')) {
      // Clear any auto-created session (we don't want auto-login)
      if (tokens) {
        try {
          await supabase.auth.signOut();
        } catch {}
      }
      try { await Browser.close(); } catch {}
      // Navigate to email confirmed page (HashRouter)
      window.location.hash = '#/email-confirmed';
      return;
    }
  });

  // ── Browser Finished Listener ──
  // If user closes the browser manually, check if session was already established
  Browser.addListener('browserFinished', async () => {
    console.log('[CapacitorDeepLink] Browser closed, checking session...');
    
    // Small delay to let any pending auth state changes propagate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[CapacitorDeepLink] Session found after browser close');
    } else {
      console.log('[CapacitorDeepLink] No session after browser close');
    }
  });

  // ── Handle tokens in the initial URL (app opened via deep link while closed) ──
  CapApp.getLaunchUrl().then(async (result) => {
    if (!result?.url) return;
    
    const url = result.url;
    const fragmentIndex = url.indexOf('#');
    const fragment = fragmentIndex !== -1 ? url.substring(fragmentIndex) : '';
    const tokens = fragment ? parseTokensFromFragment(fragment) : null;

    if (url.includes('oauth-callback') && tokens) {
      console.log('[CapacitorDeepLink] Found OAuth tokens in launch URL');
      handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
    } else if (url.includes('reset-password') && tokens) {
      console.log('[CapacitorDeepLink] Found recovery tokens in launch URL');
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      window.location.hash = '#/reset-password';
    } else if (url.includes('email-confirmed')) {
      console.log('[CapacitorDeepLink] Email confirmed via launch URL');
      if (tokens) { try { await supabase.auth.signOut(); } catch {} }
      window.location.hash = '#/email-confirmed';
    }
  });
}
