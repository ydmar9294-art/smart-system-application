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
import { logger } from '@/lib/logger';

let isInitialized = false;

/**
 * Sanitize a URL by redacting sensitive token parameters.
 * Prevents accidental token exposure in logs.
 */
function sanitizeUrl(url: string): string {
  try {
    const fragmentIndex = url.indexOf('#');
    if (fragmentIndex === -1) return url;
    
    const base = url.substring(0, fragmentIndex);
    const fragment = url.substring(fragmentIndex + 1);
    const params = new URLSearchParams(fragment);
    
    const sensitiveKeys = ['access_token', 'refresh_token', 'token', 'code', 'id_token'];
    for (const key of sensitiveKeys) {
      if (params.has(key)) {
        params.set(key, '[REDACTED]');
      }
    }
    
    return `${base}#${params.toString()}`;
  } catch {
    return '[URL_PARSE_ERROR]';
  }
}

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
    try {
      await Browser.close();
    } catch {
      // Browser might already be closed
    }

    logger.info('[CAPACITOR_OAUTH] Setting session from deep link tokens', 'CapacitorDeepLink');
    
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      logger.error('[CAPACITOR_OAUTH] Failed to set session', 'CapacitorDeepLink', { reason: error.message });
      clearOAuthPending();
      window.dispatchEvent(new CustomEvent('capacitor-oauth-failed', { detail: { error: error.message } }));
      return false;
    }

    logger.info('[CAPACITOR_OAUTH] Session set successfully — broadcasting', 'CapacitorDeepLink', { userId: data.user?.id });
    
    // Broadcast a reliable event that AuthFlow can listen to
    // This bypasses race conditions with onAuthStateChange
    window.dispatchEvent(new CustomEvent('capacitor-oauth-session-ready', {
      detail: { userId: data.user?.id, user: data.user }
    }));
    
    return true;
  } catch (err) {
    logger.error('[CAPACITOR_OAUTH] Error setting session', 'CapacitorDeepLink');
    clearOAuthPending();
    window.dispatchEvent(new CustomEvent('capacitor-oauth-failed', { detail: { error: 'unknown' } }));
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
  logger.info('Initializing deep link listeners', 'CapacitorDeepLink');

  // ── Deep Link Listener ──
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    logger.info('Deep link received', 'CapacitorDeepLink', { url: sanitizeUrl(url) });

    // Validate deep link origin scheme
    if (!url.startsWith('myapp://')) {
      logger.warn('Rejected deep link with unexpected scheme', 'CapacitorDeepLink');
      return;
    }

    const fragmentIndex = url.indexOf('#');
    const fragment = fragmentIndex !== -1 ? url.substring(fragmentIndex) : '';
    const tokens = fragment ? parseTokensFromFragment(fragment) : null;

    // ── OAuth Callback ──
    if (url.includes('oauth-callback')) {
      clearOAuthPending();
      if (!tokens) {
        logger.warn('No tokens found in OAuth deep link', 'CapacitorDeepLink');
        return;
      }
      await handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
      return;
    }

    // ── Reset Password ──
    if (url.includes('reset-password')) {
      if (tokens) {
        await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        try { await Browser.close(); } catch {}
      }
      window.location.hash = '#/reset-password';
      return;
    }

    // ── Email Confirmed ──
    if (url.includes('email-confirmed')) {
      if (tokens) {
        try {
          await supabase.auth.signOut();
        } catch {}
      }
      try { await Browser.close(); } catch {}
      window.location.hash = '#/email-confirmed';
      return;
    }
  });

  // ── Browser Finished Listener ──
  Browser.addListener('browserFinished', async () => {
    logger.info('Browser closed, checking session...', 'CapacitorDeepLink');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      logger.info('Session found after browser close', 'CapacitorDeepLink');
    } else {
      logger.info('No session after browser close', 'CapacitorDeepLink');
    }
  });

  // ── Handle tokens in the initial URL (app opened via deep link while closed) ──
  CapApp.getLaunchUrl().then(async (result) => {
    if (!result?.url) return;
    
    const url = result.url;

    if (!url.startsWith('myapp://')) {
      logger.warn('Rejected launch URL with unexpected scheme', 'CapacitorDeepLink');
      return;
    }

    const fragmentIndex = url.indexOf('#');
    const fragment = fragmentIndex !== -1 ? url.substring(fragmentIndex) : '';
    const tokens = fragment ? parseTokensFromFragment(fragment) : null;

    if (url.includes('oauth-callback') && tokens) {
      logger.info('Found OAuth tokens in launch URL', 'CapacitorDeepLink');
      handleOAuthTokens(tokens.accessToken, tokens.refreshToken);
    } else if (url.includes('reset-password') && tokens) {
      logger.info('Found recovery tokens in launch URL', 'CapacitorDeepLink');
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      window.location.hash = '#/reset-password';
    } else if (url.includes('email-confirmed')) {
      logger.info('Email confirmed via launch URL', 'CapacitorDeepLink');
      if (tokens) { try { await supabase.auth.signOut(); } catch {} }
      window.location.hash = '#/email-confirmed';
    }
  });
}
