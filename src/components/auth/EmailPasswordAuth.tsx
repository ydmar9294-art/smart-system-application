import React, { useState } from 'react';
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmailPasswordAuthProps {
  onError?: (error: string) => void;
  disabled?: boolean;
}

const EmailPasswordAuth: React.FC<EmailPasswordAuthProps> = ({ onError, disabled = false }) => {
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
    if (message.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    if (message.includes('Email not confirmed')) return 'يرجى تأكيد البريد الإلكتروني أولاً. تحقق من صندوق الوارد';
    if (message.includes('User already registered')) return 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول';
    if (message.includes('Password should be at least')) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    if (message.includes('Unable to validate email')) return 'صيغة البريد الإلكتروني غير صحيحة';
    if (message.includes('Signup requires a valid password')) return 'يرجى إدخال كلمة مرور صالحة';
    if (message.includes('rate limit')) return 'محاولات كثيرة. يرجى الانتظار قليلاً';
    return message || 'حدث خطأ غير متوقع';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || disabled) return;

    setLocalError('');
    setSignUpSuccess(false);

    if (!email.trim()) {
      setLocalError('يرجى إدخال البريد الإلكتروني');
      return;
    }

    if (!password) {
      setLocalError('يرجى إدخال كلمة المرور');
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        setLocalError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('كلمات المرور غير متطابقة');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          const msg = translateError(error.message);
          setLocalError(msg);
          onError?.(msg);
          return;
        }

        // Show success message — user needs to confirm email
        setSignUpSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = translateError(error.message);
          setLocalError(msg);
          onError?.(msg);
          return;
        }
        // onAuthStateChange in AuthFlow will handle the rest
      }
    } catch (err: any) {
      const msg = translateError(err.message || '');
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('يرجى إدخال البريد الإلكتروني أولاً');
      return;
    }
    setLoading(true);
    setLocalError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setLocalError(translateError(error.message));
        return;
      }
      setResetSent(true);
    } catch (err: any) {
      setLocalError(translateError(err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-foreground">تم إرسال رابط الاستعادة</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            تم إرسال رابط استعادة كلمة المرور إلى <span className="font-bold text-foreground">{email}</span>. يرجى فتح بريدك الإلكتروني.
          </p>
        </div>
        <button
          onClick={() => { setResetSent(false); setForgotPassword(false); }}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    );
  }

  if (signUpSuccess) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-foreground">تم إنشاء الحساب بنجاح</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            يمكنك الآن تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.
          </p>
        </div>
        <button
          onClick={() => {
            setSignUpSuccess(false);
            setIsSignUp(false);
            setPassword('');
            setConfirmPassword('');
          }}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          تسجيل الدخول الآن
        </button>
      </div>
    );
  }

  if (forgotPassword) {
    return (
      <div className="space-y-4">
        {localError && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-bold">{localError}</p>
          </div>
        )}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-black text-foreground">استعادة كلمة المرور</h3>
          <p className="text-sm text-muted-foreground">أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            البريد الإلكتروني
          </label>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
            dir="ltr"
          />
        </div>
        <button
          onClick={handleForgotPassword}
          disabled={loading}
          className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رابط الاستعادة'}
        </button>
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => { setForgotPassword(false); setLocalError(''); }}
            className="text-sm text-primary font-bold hover:underline transition-colors"
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {localError && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{localError}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          البريد الإلكتروني
        </label>
        <input
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || disabled}
          className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
          dir="ltr"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          كلمة المرور
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || disabled}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 pl-12"
            dir="ltr"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isSignUp && (
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            تأكيد كلمة المرور
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || disabled}
            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>
      )}

      {!isSignUp && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => { setForgotPassword(true); setLocalError(''); }}
            className="text-xs text-muted-foreground hover:text-primary font-bold transition-colors"
          >
            نسيت كلمة المرور؟
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10 hover:shadow-2xl hover:shadow-foreground/20"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isSignUp ? (
          <>
            <UserPlus className="w-5 h-5" />
            إنشاء حساب جديد
          </>
        ) : (
          <>
            <LogIn className="w-5 h-5" />
            تسجيل الدخول
          </>
        )}
      </button>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setLocalError('');
            setPassword('');
            setConfirmPassword('');
          }}
          className="text-sm text-primary font-bold hover:underline transition-colors"
        >
          {isSignUp ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
        </button>
      </div>
    </form>
  );
};

export default EmailPasswordAuth;
