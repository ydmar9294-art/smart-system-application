import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { setOAuthPending, isOAuthPending, clearOAuthPending } from '@/lib/oauthState';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onError?: (error: string) => void;
  oauthInProgress?: boolean;
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
 * Ultra Google Sign-In Button — Liquid-Glass + Predictive Motion
 * 
 * Features:
 * - Pre-warm Chrome Custom Tab on mount
 * - Predictive touch (scale on touch-down)
 * - Morphing portal animation
 * - Glass glow effects
 * - Latency illusion shimmer
 * - Success pulse animation
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  disabled = false, 
  onError,
  oauthInProgress = false,
  loadingText
}) => {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'pressed' | 'morphing' | 'waiting' | 'success'>('idle');
  const [shimmerProgress, setShimmerProgress] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const shimmerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pre-warm Chrome Custom Tab on mount ──
  useEffect(() => {
    if (isNativePlatform()) {
      // Preconnect hint for faster Custom Tab opening
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://accounts.google.com';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = 'https://accounts.google.com';
      document.head.appendChild(dnsPrefetch);

      return () => {
        link.remove();
        dnsPrefetch.remove();
      };
    }
  }, []);

  // On mount, check if we were in the middle of an OAuth flow
  useEffect(() => {
    if (isNativePlatform() && isOAuthPending()) {
      setLoading(true);
      setPhase('waiting');
      startShimmer();
    }
  }, []);

  // Sync with external oauthInProgress prop
  useEffect(() => {
    if (oauthInProgress && !loading) {
      setLoading(true);
      setPhase('waiting');
      startShimmer();
    }
    if (!oauthInProgress && loading && !isOAuthPending()) {
      // Auth completed successfully
      setPhase('success');
      stopShimmer();
      setTimeout(() => {
        setLoading(false);
        setPhase('idle');
      }, 800);
    }
  }, [oauthInProgress]);

  const startShimmer = useCallback(() => {
    setShimmerProgress(0);
    shimmerInterval.current = setInterval(() => {
      setShimmerProgress(prev => {
        // Slow asymptotic progress — never reaches 100
        const increment = Math.max(0.3, (90 - prev) * 0.02);
        return Math.min(prev + increment, 92);
      });
    }, 100);
  }, []);

  const stopShimmer = useCallback(() => {
    if (shimmerInterval.current) {
      clearInterval(shimmerInterval.current);
      shimmerInterval.current = null;
    }
    setShimmerProgress(100);
  }, []);

  useEffect(() => {
    return () => {
      if (shimmerInterval.current) clearInterval(shimmerInterval.current);
    };
  }, []);

  const handleTouchStart = () => {
    if (loading || disabled) return;
    setPhase('pressed');
  };

  const handleTouchEnd = () => {
    if (phase === 'pressed') {
      setPhase('idle');
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || disabled) return;
    
    // Morph animation
    setPhase('morphing');
    setLoading(true);

    // Brief morph delay for visual feedback
    await new Promise(r => setTimeout(r, 150));
    setPhase('waiting');
    startShimmer();

    try {
      if (isNativePlatform()) {
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

          const handle = await Browser.addListener('browserFinished', () => {
            setTimeout(() => {
              if (isOAuthPending()) {
                clearOAuthPending();
                stopShimmer();
                setPhase('idle');
                setLoading(false);
              }
            }, 1500);
            handle.remove();
          });
        }
      } else {
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
      }
    } catch (err: any) {
      console.error('[GoogleAuth] Error:', err);
      clearOAuthPending();
      stopShimmer();
      setPhase('idle');
      setLoading(false);
      const message = err?.message?.includes('rate limit')
        ? 'محاولات كثيرة. يرجى الانتظار قليلاً'
        : 'فشل تسجيل الدخول بجوجل. يرجى المحاولة مرة أخرى';
      onError?.(message);
    }
  };

  const isActive = loading || oauthInProgress;

  const getButtonClasses = () => {
    const base = 'google-signin-btn w-full relative overflow-hidden rounded-2xl font-bold text-sm transition-all duration-200';
    
    if (phase === 'success') {
      return `${base} google-signin-success`;
    }
    if (phase === 'morphing') {
      return `${base} google-signin-morphing`;
    }
    if (phase === 'pressed') {
      return `${base} google-signin-pressed`;
    }
    if (isActive) {
      return `${base} google-signin-active`;
    }
    return `${base} google-signin-idle`;
  };

  return (
    <div className="relative">
      {/* Glow backdrop when active */}
      {isActive && phase !== 'success' && (
        <div className="google-signin-glow-backdrop" />
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={handleGoogleSignIn}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        disabled={isActive || disabled}
        className={getButtonClasses()}
      >
        {/* Glass highlight overlay */}
        <div className="google-signin-glass-highlight" />

        {/* Shimmer progress bar */}
        {isActive && phase === 'waiting' && (
          <div className="google-signin-progress-track">
            <div 
              className="google-signin-progress-bar"
              style={{ width: `${shimmerProgress}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-3 py-3.5 px-4">
          {phase === 'success' ? (
            <div className="flex items-center gap-3 google-signin-success-content">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span className="text-success font-black">تم تسجيل الدخول ✓</span>
            </div>
          ) : isActive ? (
            <div className="flex items-center gap-3">
              <div className="google-signin-spinner">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <span className="text-muted-foreground font-bold">
                {loadingText || 'جارٍ تسجيل الدخول...'}
              </span>
            </div>
          ) : (
            <>
              <div className="google-signin-icon">
                {GOOGLE_SVG}
              </div>
              <span className="text-foreground">تسجيل الدخول عبر Google</span>
            </>
          )}
        </div>

        {/* Ripple effect on touch */}
        {phase === 'morphing' && (
          <div className="google-signin-ripple" />
        )}
      </button>
    </div>
  );
};

export default GoogleSignInButton;
