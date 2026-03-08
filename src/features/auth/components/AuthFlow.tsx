import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, XCircle, Zap, BarChart3, Lock, RefreshCw, ShieldCheck, Eye } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuth, clearAuthCache } from '@/lib/authCache';
import { checkAuthStatus } from '@/hooks/useAuthOperations';
import { isOAuthPending, clearOAuthPending } from '@/lib/oauthState';
import EmailPasswordAuth from './EmailPasswordAuth';
import GoogleSignInButton from './GoogleSignInButton';
import LicenseActivation from './LicenseActivation';
import AuthOverlay from './AuthOverlay';
import GuestRoleSelector from './GuestRoleSelector';
import { useGuest, GuestRole } from '@/store/GuestContext';

interface AuthFlowProps {
  onAuthComplete: () => void;
}

type LoadingPhase = 'returning' | 'validating_license' | 'checking_status';

const PHASE_LABELS: Record<LoadingPhase, string> = {
  returning: 'جارٍ تسجيل الدخول...',
  validating_license: 'جارٍ التحقق من الترخيص...',
  checking_status: 'جارٍ التحقق من حالة الحساب...'
};

type AuthState =
{type: 'initial';} |
{type: 'loading';startedAt: number;phase: LoadingPhase;} |
{type: 'needs_activation';userId: string;email: string;fullName: string;} |
{type: 'access_denied';reason: string;message: string;} |
{type: 'error';message: string;canRetry?: boolean;};

/** Max time for verification before showing error */
const VERIFY_TIMEOUT_MS = 12_000;
/** After this many ms, show "taking longer than expected" */
const SLOW_THRESHOLD_MS = 5_000;

const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthComplete }) => {
  const [authState, setAuthState] = useState<AuthState>({ type: 'initial' });
  const [authError, setAuthError] = useState<string>('');
  const [isSlow, setIsSlow] = useState(false);
  const [oauthPending, setOauthPending] = useState(() => isOAuthPending());
  const [showGuestSelector, setShowGuestSelector] = useState(false);
  const { enterGuestMode } = useGuest();

  const handleGuestSelect = (role: GuestRole) => {
    setShowGuestSelector(false);
    enterGuestMode(role);
  };
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {clearTimeout(timeoutRef.current);timeoutRef.current = null;}
    if (slowTimerRef.current) {clearTimeout(slowTimerRef.current);slowTimerRef.current = null;}
    setIsSlow(false);
  }, []);

  const startVerification = useCallback((phase: LoadingPhase = 'returning') => {
    clearTimers();
    setAuthState({ type: 'loading', startedAt: Date.now(), phase });

    // Show "slow" indicator after threshold
    slowTimerRef.current = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS);

    // Hard timeout — guaranteed error state
    timeoutRef.current = setTimeout(() => {
      setAuthState({
        type: 'error',
        message: 'استغرق التحقق وقتاً طويلاً. يرجى المحاولة مرة أخرى.',
        canRetry: true
      });
      setIsSlow(false);
    }, VERIFY_TIMEOUT_MS);
  }, [clearTimers]);

  /** Yield to the renderer so loading UI paints before heavy work */
  const yieldToRenderer = useCallback(() =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))), []);

  const checkUserProfile = useCallback(async (userId: string, user: any) => {
    try {
      const email = user.email || '';
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || '';

      // Phase: validating license — yield so spinner renders first
      setAuthState((prev) => prev.type === 'loading' ? { ...prev, phase: 'validating_license' } : prev);
      await yieldToRenderer();

      const status = await Promise.race([
      checkAuthStatus(),
      new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('VERIFY_TIMEOUT')), VERIFY_TIMEOUT_MS - 1000)
      )]
      );

      clearTimers();
      clearOAuthPending();
      setOauthPending(false);

      if (!status.authenticated) {
        setAuthState({ type: 'needs_activation', userId, email, fullName });
        return;
      }

      // Phase: checking account status — yield so phase label updates visually
      setAuthState((prev) => prev.type === 'loading' ? { ...prev, phase: 'checking_status' } : prev);
      await yieldToRenderer();

      if (status.access_denied) {
        setAuthState({
          type: 'access_denied',
          reason: status.reason || 'UNKNOWN',
          message: status.message || 'تم رفض الوصول'
        });
        return;
      }

      if (status.needs_activation) {
        setAuthState({
          type: 'needs_activation',
          userId,
          email: status.email || email,
          fullName: status.full_name || fullName
        });
        return;
      }

      onAuthComplete();
    } catch (err: any) {
      clearTimers();
      clearOAuthPending();
      setOauthPending(false);
      console.error('[AuthFlow] Check profile error:', err);
      const isTimeout = err?.message === 'VERIFY_TIMEOUT';
      setAuthState({
        type: 'error',
        message: isTimeout ?
        'استغرق التحقق وقتاً طويلاً. يرجى المحاولة مرة أخرى.' :
        err.message || 'حدث خطأ في التحقق من الحساب',
        canRetry: true
      });
    }
  }, [onAuthComplete, clearTimers]);

  // Listen for auth state changes
  useEffect(() => {
    const cached = getCachedAuth();
    const cacheIsFullyActivated = cached && cached.organizationId && cached.role;

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthFlow] Auth event:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        if (cacheIsFullyActivated && cached.userId === session.user.id) {
          console.log('[AuthFlow] Cache hit - fast completing auth');
          onAuthComplete();
          return;
        }

        if (cached && !cacheIsFullyActivated) {
          clearAuthCache();
        }

        startVerification();
        // Yield so the loading spinner renders before heavy verification
        await yieldToRenderer();
        await checkUserProfile(session.user.id, session.user);
      } else if (event === 'SIGNED_OUT') {
        clearAuthCache();
        clearTimers();
        setAuthState({ type: 'initial' });
      }
    });

    // Check initial session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (cacheIsFullyActivated && cached.userId === session.user.id) {
          console.log('[AuthFlow] Initial cache hit - fast completing auth');
          onAuthComplete();
          return;
        }

        if (cached && !cacheIsFullyActivated) {
          clearAuthCache();
        }

        startVerification();
        await yieldToRenderer();
        await checkUserProfile(session.user.id, session.user);
      }
    };

    checkSession();

    return () => {
      listener.subscription.unsubscribe();
      clearTimers();
    };
  }, [checkUserProfile, onAuthComplete, startVerification, clearTimers]);

  const handleLogout = async () => {
    clearAuthCache();
    clearOAuthPending();
    setOauthPending(false);
    await supabase.auth.signOut();
    clearTimers();
    setAuthState({ type: 'initial' });
    setAuthError('');
  };

  const handleRetry = async () => {
    setAuthState({ type: 'initial' });
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      startVerification();
      await yieldToRenderer();
      await checkUserProfile(session.user.id, session.user);
    }
  };

  const handleActivationSuccess = () => {
    onAuthComplete();
  };

  const handleAuthError = (error: string) => {
    setAuthError(error);
  };

  const renderContent = () => {
    switch (authState.type) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-bold text-sm">{PHASE_LABELS[authState.phase]}</p>
            {isSlow &&
            <div className="text-center space-y-2 animate-in fade-in duration-300">
                <p className="text-xs text-muted-foreground/70">يستغرق الأمر وقتاً أطول من المعتاد...</p>
                <button
                onClick={handleLogout}
                className="text-xs text-destructive hover:underline font-bold">

                  إلغاء وتسجيل الخروج
                </button>
              </div>
            }
          </div>);

      case 'needs_activation':
        return (
          <LicenseActivation
            userId={authState.userId}
            email={authState.email}
            fullName={authState.fullName}
            onSuccess={handleActivationSuccess}
            onLogout={handleLogout} />);

      case 'access_denied':
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-destructive">تم رفض الوصول</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {authState.message}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-8 py-3 bg-muted text-foreground rounded-2xl font-bold text-sm hover:bg-muted/80 transition-colors">
              تسجيل الخروج
            </button>
          </div>);

      case 'error':
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-destructive">حدث خطأ</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {authState.message}
              </p>
            </div>
            <div className="flex flex-col gap-3 items-center">
              {authState.canRetry &&
              <button
                onClick={handleRetry}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </button>
              }
              <button
                onClick={handleLogout}
                className="px-8 py-3 bg-muted text-foreground rounded-2xl font-bold text-sm hover:bg-muted/80 transition-colors">
                تسجيل الخروج
              </button>
            </div>
          </div>);

      case 'initial':
      default:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2 pb-4">
              <h3 className="text-lg font-black text-foreground">مرحباً بك</h3>
              <p className="text-xs text-muted-foreground">
                سجل دخولك بالبريد الإلكتروني وكلمة المرور
              </p>
            </div>
            
            {/* Google OAuth */}
            <GoogleSignInButton
              onError={handleAuthError}
              oauthInProgress={oauthPending}
              loadingText={oauthPending ? 'جارٍ العودة من Google...' : undefined} />

            
            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-bold">أو</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            
            <EmailPasswordAuth onError={handleAuthError} />

            {/* Divider before guest */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-bold">أو</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Guest preview button */}
            <button
              type="button"
              onClick={() => setShowGuestSelector(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all duration-200 active:scale-[0.97]"
            >
              <Eye className="w-4 h-4" />
              دخول كزائر
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span>تسجيل دخول آمن ومشفر</span>
            </div>

            {/* Guest role selector modal */}
            <GuestRoleSelector
              open={showGuestSelector}
              onClose={() => setShowGuestSelector(false)}
              onSelect={handleGuestSelect}
            />
          </div>);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-tajawal relative bg-background" dir="rtl">
      {/* Auth overlay — shows when OAuth browser is open */}
      <AuthOverlay visible={oauthPending && authState.type === 'initial'} />

      {/* Top bar overlay — glass blur bar so content scrolls under */}
      <div className="auth-edge-bar auth-edge-bar--top" />
      {/* Bottom bar overlay */}
      <div className="auth-edge-bar auth-edge-bar--bottom" />

      <div className="bg-slate-900 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-16 px-6 relative overflow-hidden flex flex-col items-center shrink-0">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="mb-5 z-10 animate-float animate-logo-glow">
          <AppLogo size={80} />
        </div>
        <h1 className="text-3xl font-black mb-2 tracking-tight z-10 animate-title-gradient">النظام الذكي</h1>
        <p className="text-white/40 text-[11px] font-bold z-10 text-center leading-relaxed max-w-[200px] my-[5px]">
          ● الخاص بإدارة البيع و التوزيع ●
        </p>
        <div className="flex items-center justify-center gap-6 mt-6 z-10">
          {[
            { icon: <Lock className="w-5 h-5 text-emerald-400" />, label: 'آمن', delay: '0s' },
            { icon: <BarChart3 className="w-5 h-5 text-cyan-400" />, label: 'دقيق', delay: '2.5s' },
            { icon: <Zap className="w-5 h-5 text-amber-400" />, label: 'سريع', delay: '5s' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 animate-float" style={{ animationDelay: `${i * 0.4}s` }}>
              <div className="glass-capsule w-14 h-14 rounded-[1.2rem] flex items-center justify-center" style={{ '--sweep-delay': item.delay } as React.CSSProperties}>
                {item.icon}
              </div>
              <span className="text-white/50 text-[10px] font-black">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-md w-full mx-auto px-6 -mt-8 z-20 flex-1 flex flex-col pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="glass-surface rounded-[2.5rem] shadow-xl overflow-hidden p-6">
          {renderContent()}
        </div>
      </div>
    </div>);
};

export default AuthFlow;