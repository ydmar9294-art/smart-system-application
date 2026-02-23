import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onError?: (error: string) => void;
}

const GOOGLE_SVG = (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

/**
 * Detects if the app is running inside a Capacitor native shell
 */
const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Google Sign-In Button - Works on both Web and Capacitor (Android/iOS)
 * 
 * Web: Uses standard Supabase OAuth redirect flow
 * Native: Opens system browser via Capacitor Browser plugin, handles deep link callback
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ disabled = false, onError }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading || disabled) return;
    setLoading(true);

    try {
      if (isNativePlatform()) {
        // ═══ NATIVE (Capacitor) FLOW ═══
        // Use signInWithOAuth but get the URL manually, then open in system browser
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            skipBrowserRedirect: true, // Don't redirect WebView
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) throw error;

        if (data?.url) {
          // Open the OAuth URL in the system browser (not WebView)
          await Browser.open({ url: data.url, windowName: '_system' });
        }
      } else {
        // ═══ WEB FLOW ═══
        // Standard redirect-based OAuth
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
        // Browser will redirect to Google → Supabase → /auth/callback
      }
    } catch (err: any) {
      console.error('[GoogleAuth] Error:', err);
      const message = err?.message?.includes('rate limit')
        ? 'محاولات كثيرة. يرجى الانتظار قليلاً'
        : 'فشل تسجيل الدخول بجوجل. يرجى المحاولة مرة أخرى';
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading || disabled}
      className="w-full py-3.5 bg-muted border border-border rounded-2xl font-bold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 hover:bg-accent text-foreground"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          {GOOGLE_SVG}
          <span>تسجيل الدخول بجوجل</span>
        </>
      )}
    </button>
  );
};

export default GoogleSignInButton;
