import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { setOAuthPending, isOAuthPending, clearOAuthPending } from '@/lib/oauthState';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onError?: (error: string) => void;
  /** When true, an external OAuth flow is in progress (shows loading) */
  oauthInProgress?: boolean;
  /** Optional loading text to display (e.g. phase-specific) */
  loadingText?: string;
}

const GOOGLE_SVG = (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

/**
 * Google Sign-In Button
 * 
 * On native: persists loading state via localStorage so it survives
 * the browser→app transition. Loading continues until auth completes.
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  disabled = false, 
  onError,
  oauthInProgress = false,
  loadingText
}) => {
  const [loading, setLoading] = useState(false);

  // On mount, check if we were in the middle of an OAuth flow (app resumed)
  useEffect(() => {
    if (isNativePlatform() && isOAuthPending()) {
      setLoading(true);
    }
  }, []);

  // Sync with external oauthInProgress prop
  useEffect(() => {
    if (!oauthInProgress && loading && !isOAuthPending()) {
      setLoading(false);
    }
  }, [oauthInProgress, loading]);

  const handleGoogleSignIn = async () => {
    if (loading || disabled) return;
    setLoading(true);

    try {
      if (isNativePlatform()) {
        // ═══ NATIVE (Capacitor) FLOW ═══
        // Mark OAuth as pending BEFORE opening browser
        setOAuthPending();

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'myapp://auth/oauth-callback',
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          clearOAuthPending();
          throw error;
        }

        if (data?.url) {
          await Browser.open({ url: data.url, windowName: '_blank' });

          // Listen for browser close (user cancelled)
          const handle = await Browser.addListener('browserFinished', () => {
            // Small delay: if deep link already fired, session will be set
            setTimeout(() => {
              if (isOAuthPending()) {
                // Still pending = user cancelled or flow didn't complete
                clearOAuthPending();
                setLoading(false);
              }
            }, 1500);
            handle.remove();
          });
        }
        // Do NOT reset loading here — it persists until auth completes
      } else {
        // ═══ WEB FLOW ═══
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) throw error;
        // Browser will redirect — loading stays active
      }
    } catch (err: any) {
      console.error('[GoogleAuth] Error:', err);
      clearOAuthPending();
      setLoading(false);
      const message = err?.message?.includes('rate limit')
        ? 'محاولات كثيرة. يرجى الانتظار قليلاً'
        : 'فشل تسجيل الدخول بجوجل. يرجى المحاولة مرة أخرى';
      onError?.(message);
    }
  };

  const isActive = loading || oauthInProgress;

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isActive || disabled}
      className="w-full py-3.5 bg-muted border border-border rounded-2xl font-bold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 hover:bg-accent text-foreground"
    >
      {isActive ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">{loadingText || 'جارٍ تسجيل الدخول...'}</span>
        </div>
      ) : (
        <>
          {GOOGLE_SVG}
          <span>تسجيل الدخول عبر Google</span>
        </>
      )}
    </button>
  );
};

export default GoogleSignInButton;
