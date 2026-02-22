import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { clearAuthCache } from '@/lib/authCache';

const PASSWORD_MIN_LENGTH = 10;

const validatePasswordStrength = (pw: string): string | null => {
  if (pw.length < PASSWORD_MIN_LENGTH) return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  if (!/[A-Z]/.test(pw)) return 'يجب أن تحتوي على حرف كبير واحد على الأقل';
  if (!/[a-z]/.test(pw)) return 'يجب أن تحتوي على حرف صغير واحد على الأقل';
  if (!/[0-9]/.test(pw)) return 'يجب أن تحتوي على رقم واحد على الأقل';
  return null;
};

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Verify recovery session exists on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
        } else {
          setError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية');
        }
      } catch (err) {
        setError('فشل التحقق من الجلسة');
      } finally {
        setSessionChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    // Validate strength
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message || 'فشل تحديث كلمة المرور');
        return;
      }

      setSuccess(true);

      // Sign out immediately — do NOT auto-login
      clearAuthCache();
      await supabase.auth.signOut();

      // Redirect to login after brief delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground">تم تغيير كلمة المرور بنجاح</h2>
          <p className="text-sm text-muted-foreground">
            سيتم توجيهك لصفحة تسجيل الدخول...
          </p>
        </div>
      </div>
    );
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-5">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من الرابط...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-black text-foreground">رابط غير صالح</h2>
          <p className="text-sm text-muted-foreground">{error || 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية'}</p>
          <button
            onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground">إعادة تعيين كلمة المرور</h2>
          <p className="text-sm text-muted-foreground">أدخل كلمة المرور الجديدة</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              كلمة المرور الجديدة
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 pl-12"
                dir="ltr"
                autoComplete="new-password"
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
            <ul className="text-xs text-muted-foreground space-y-1 pr-2 pt-1">
              <li className={password.length >= PASSWORD_MIN_LENGTH ? 'text-primary' : ''}>• {PASSWORD_MIN_LENGTH} أحرف على الأقل</li>
              <li className={/[A-Z]/.test(password) ? 'text-primary' : ''}>• حرف كبير واحد</li>
              <li className={/[a-z]/.test(password) ? 'text-primary' : ''}>• حرف صغير واحد</li>
              <li className={/[0-9]/.test(password) ? 'text-primary' : ''}>• رقم واحد</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              تأكيد كلمة المرور
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
              dir="ltr"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحديث كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
