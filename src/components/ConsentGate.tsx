/**
 * ConsentGate - First-launch consent flow
 * Blocks app access until user accepts Privacy Policy + Terms
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CONSENT_LOCAL_KEY = 'smart_system_consent_accepted';
const APP_VERSION = '1.0.0';

interface ConsentGateProps {
  userId: string;
  children: React.ReactNode;
}

const ConsentGate: React.FC<ConsentGateProps> = ({ userId, children }) => {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Quick local check first
    const local = localStorage.getItem(CONSENT_LOCAL_KEY);
    if (local === userId) {
      setHasConsent(true);
      return;
    }

    // Check DB
    const check = async () => {
      const { data } = await supabase
        .from('user_consents')
        .select('id')
        .eq('user_id', userId)
        .eq('consent_type', 'privacy_terms')
        .limit(1);
      
      if (data && data.length > 0) {
        localStorage.setItem(CONSENT_LOCAL_KEY, userId);
        setHasConsent(true);
      } else {
        setHasConsent(false);
      }
    };
    check();
  }, [userId]);

  const handleAccept = async () => {
    if (!checked) return;
    setSubmitting(true);
    try {
      await supabase.from('user_consents').insert({
        user_id: userId,
        consent_type: 'privacy_terms',
        app_version: APP_VERSION,
      } as any);
      localStorage.setItem(CONSENT_LOCAL_KEY, userId);
      setHasConsent(true);
    } catch (err) {
      console.error('Consent save failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (hasConsent === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Already consented
  if (hasConsent) return <>{children}</>;

  // Consent screen
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-300">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">مرحباً بك في Smart System</h1>
          <p className="text-sm text-muted-foreground font-bold">
            قبل المتابعة، يرجى مراجعة والموافقة على سياسة الخصوصية وشروط الاستخدام
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/privacy-policy')}
            className="w-full bg-card border rounded-2xl p-4 flex items-center gap-3 text-start hover:bg-muted/50 transition-colors active:scale-[0.98]"
          >
            <Shield size={20} className="text-primary flex-shrink-0" />
            <div>
              <p className="font-black text-foreground text-sm">سياسة الخصوصية</p>
              <p className="text-xs text-muted-foreground">كيف نجمع ونحمي بياناتك</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/terms')}
            className="w-full bg-card border rounded-2xl p-4 flex items-center gap-3 text-start hover:bg-muted/50 transition-colors active:scale-[0.98]"
          >
            <FileText size={20} className="text-primary flex-shrink-0" />
            <div>
              <p className="font-black text-foreground text-sm">شروط الاستخدام</p>
              <p className="text-xs text-muted-foreground">قواعد وأحكام استخدام التطبيق</p>
            </div>
          </button>
        </div>

        <label className="flex items-start gap-3 bg-card border rounded-2xl p-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-2 border-primary text-primary accent-primary flex-shrink-0"
          />
          <span className="text-sm font-bold text-foreground leading-relaxed">
            قرأت وأوافق على <span className="text-primary">سياسة الخصوصية</span> و<span className="text-primary">شروط الاستخدام</span>
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {submitting ? 'جاري الحفظ...' : 'موافق ومتابعة'}
        </button>
      </div>
    </div>
  );
};

export default ConsentGate;
