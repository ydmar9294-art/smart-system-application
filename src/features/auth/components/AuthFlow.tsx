import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, XCircle, Zap, BarChart3, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import appLogo from '@/assets/logo-buildings.png';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuth, clearAuthCache } from '@/lib/authCache';
import { checkAuthStatus } from '@/hooks/useAuthOperations';
import EmailPasswordAuth from './EmailPasswordAuth';
import GoogleSignInButton from './GoogleSignInButton';
import LicenseActivation from './LicenseActivation';

interface AuthFlowProps {
  onAuthComplete: () => void;
}

type AuthState =
{type: 'initial';} |
{type: 'loading'; startedAt: number;} |
{type: 'needs_activation';userId: string;email: string;fullName: string;} |
{type: 'access_denied';reason: string;message: string;} |
{type: 'error';message: string; canRetry?: boolean;};

/** Max time for verification before showing error */
const VERIFY_TIMEOUT_MS = 12_000;
/** After this many ms, show "taking longer than expected" */
const SLOW_THRESHOLD_MS = 5_000;

const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthComplete }) => {
  const [authState, setAuthState] = useState<AuthState>({ type: 'initial' });
  const [authError, setAuthError] = useState<string>('');
  const [isSlow, setIsSlow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
    setIsSlow(false);
  }, []);

  const startVerification = useCallback(() => {
    clearTimers();
    setAuthState({ type: 'loading', startedAt: Date.now() });
    
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

  const checkUserProfile = useCallback(async (userId: string, user: any) => {
    try {
      const email = user.email || '';
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || '';

      const status = await Promise.race([
        checkAuthStatus(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('VERIFY_TIMEOUT')), VERIFY_TIMEOUT_MS - 1000)
        )
      ]);

      clearTimers();

      if (!status.authenticated) {
        setAuthState({ type: 'needs_activation', userId, email, fullName });
        return;
      }

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
      console.error('[AuthFlow] Check profile error:', err);
      const isTimeout = err?.message === 'VERIFY_TIMEOUT';
      setAuthState({
        type: 'error',
        message: isTimeout 
          ? 'استغرق التحقق وقتاً طويلاً. يرجى المحاولة مرة أخرى.'
          : (err.message || 'حدث خطأ في التحقق من الحساب'),
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
            <p className="text-muted-foreground font-bold text-sm">جارٍ التحقق من الحساب...</p>
            {isSlow && (
              <div className="text-center space-y-2 animate-in fade-in duration-300">
                <p className="text-xs text-muted-foreground/70">يستغرق الأمر وقتاً أطول من المعتاد...</p>
                <button
                  onClick={handleLogout}
                  className="text-xs text-destructive hover:underline font-bold"
                >
                  إلغاء وتسجيل الخروج
                </button>
              </div>
            )}
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
              {authState.canRetry && (
                <button
                  onClick={handleRetry}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </button>
              )}
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
            <GoogleSignInButton onError={handleAuthError} />
            
            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-bold">أو</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            
            <EmailPasswordAuth onError={handleAuthError} />
            
            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span>تسجيل دخول آمن ومشفر</span>
            </div>
          </div>);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-tajawal relative bg-background" dir="rtl">
      <div className="bg-slate-900 pt-14 pb-16 px-6 relative overflow-hidden flex flex-col items-center shrink-0">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="w-20 h-20 rounded-[1.8rem] flex items-center justify-center shadow-2xl mb-5 z-10 border-4 border-white/5 animate-float overflow-hidden">
          <img src={appLogo} alt="Smart System" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight z-10">النظام الذكي</h1>
        <p className="text-white/50 text-[11px] font-bold z-10 text-center leading-relaxed max-w-[200px] my-[5px]">
          ✨ الخاص بإدارة  البيع و التوزيع ✨
        </p>
        <div className="flex items-center justify-center gap-8 mt-6 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-white/60 text-[10px] font-bold">آمن</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-white/60 text-[10px] font-bold">دقيق</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-white/60 text-[10px] font-bold">سريع</span>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto px-6 -mt-8 z-20 flex-1 flex flex-col pb-24">
        <div className="glass-surface rounded-[2.5rem] shadow-xl overflow-hidden p-6">
          {renderContent()}
        </div>
      </div>
    </div>);
};

export default AuthFlow;
