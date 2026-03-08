import React, { useState } from 'react';
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

interface EmailPasswordAuthProps {
  onError?: (error: string) => void;
  disabled?: boolean;
}

const EmailPasswordAuth: React.FC<EmailPasswordAuthProps> = ({ onError, disabled = false }) => {
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const translateError = (message: string): string => {
    if (message.includes('Invalid login credentials')) return t('auth.invalidCredentials');
    if (message.includes('Email not confirmed')) return t('auth.emailNotConfirmed');
    if (message.includes('User already registered')) return t('auth.alreadyRegistered');
    if (message.includes('Password should be at least')) return t('auth.passwordMin6');
    if (message.includes('Unable to validate email')) return t('auth.invalidEmail');
    if (message.includes('Signup requires a valid password')) return t('auth.validPassword');
    if (message.includes('rate limit')) return t('auth.rateLimited');
    return message || t('auth.unexpectedError');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || disabled) return;
    setLocalError(''); setSignUpSuccess(false);

    if (!email.trim()) { setLocalError(t('auth.enterEmail')); return; }
    if (!password) { setLocalError(t('auth.enterPassword')); return; }
    if (isSignUp) {
      if (password.length < 6) { setLocalError(t('auth.passwordMin6')); return; }
      if (password !== confirmPassword) { setLocalError(t('auth.passwordMismatch')); return; }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const emailRedirectTo = Capacitor.isNativePlatform() ? 'myapp://auth/email-confirmed' : `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo } });
        if (error) { const msg = translateError(error.message); setLocalError(msg); onError?.(msg); return; }
        setSignUpSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { const msg = translateError(error.message); setLocalError(msg); onError?.(msg); return; }
      }
    } catch (err: any) {
      const msg = translateError(err.message || '');
      setLocalError(msg); onError?.(msg);
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setLocalError(t('auth.enterEmailFirst')); return; }
    setLoading(true); setLocalError('');
    try {
      const { data: exists, error: checkError } = await supabase.rpc('check_email_exists_rpc', { p_email: email.trim() });
      if (checkError) { console.error('[ForgotPassword] Email check error:', checkError); setLocalError(t('auth.emailCheckError')); return; }
      if (!exists) { setLocalError(t('auth.emailNotFound')); return; }
      const redirectTo = Capacitor.isNativePlatform() ? 'myapp://auth/reset-password' : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) { setLocalError(translateError(error.message)); return; }
      setResetSent(true);
    } catch (err: any) { setLocalError(translateError(err.message || '')); }
    finally { setLoading(false); }
  };

  if (resetSent) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><Mail className="w-8 h-8 text-primary" /></div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-foreground">{t('auth.resetLinkSent')}</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {t('auth.resetLinkSentDesc')} <span className="font-bold text-foreground">{email}</span>. {t('auth.checkEmail')}
          </p>
        </div>
        <button onClick={() => { setResetSent(false); setForgotPassword(false); }} className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors">
          {t('auth.backToLogin')}
        </button>
      </div>
    );
  }

  if (signUpSuccess) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><Mail className="w-8 h-8 text-primary" /></div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-foreground">{t('auth.accountCreated')}</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('auth.accountCreatedDesc')}</p>
        </div>
        <button onClick={() => { setSignUpSuccess(false); setIsSignUp(false); setPassword(''); setConfirmPassword(''); }}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors">
          {t('auth.loginNow')}
        </button>
      </div>
    );
  }

  if (forgotPassword) {
    return (
      <div className="space-y-4">
        {localError && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm font-bold">{localError}</p>
          </div>
        )}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-black text-foreground">{t('auth.resetPassword')}</h3>
          <p className="text-sm text-muted-foreground">{t('auth.resetSubtitle')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />{t('auth.email')}</label>
          <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50" dir="ltr" />
        </div>
        <button onClick={handleForgotPassword} disabled={loading}
          className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.sendResetLink')}
        </button>
        <div className="text-center pt-2">
          <button type="button" onClick={() => { setForgotPassword(false); setLocalError(''); }} className="text-sm text-primary font-bold hover:underline transition-colors">
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {localError && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm font-bold">{localError}</p>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />{t('auth.email')}</label>
        <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading || disabled}
          className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50" dir="ltr" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />{t('auth.password')}</label>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading || disabled}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 pl-12" dir="ltr" autoComplete={isSignUp ? 'new-password' : 'current-password'} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {isSignUp && (
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />{t('auth.confirmPassword')}</label>
          <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading || disabled}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50" dir="ltr" autoComplete="new-password" />
        </div>
      )}
      {!isSignUp && (
        <div className="text-right">
          <button type="button" onClick={() => { setForgotPassword(true); setLocalError(''); }} className="text-xs text-muted-foreground hover:text-primary font-bold transition-colors">
            {t('auth.forgotPassword')}
          </button>
        </div>
      )}
      <button type="submit" disabled={loading || disabled}
        className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10 hover:shadow-2xl hover:shadow-foreground/20">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSignUp ? <><UserPlus className="w-5 h-5" />{t('auth.signup')}</> : <><LogIn className="w-5 h-5" />{t('auth.login')}</>}
      </button>
      <div className="text-center pt-2">
        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setLocalError(''); setPassword(''); setConfirmPassword(''); }}
          className="text-sm text-primary font-bold hover:underline transition-colors">
          {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
        </button>
      </div>
    </form>
  );
};

export default EmailPasswordAuth;
