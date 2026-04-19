/**
 * SelfServiceTrialModal — نافذة Native لإنشاء حساب تجريبي ذاتي (15 يوم).
 * تُجمع: الاسم الكامل، اسم الشركة، عدد الموزعين، رقم الهاتف، رقم الواتساب.
 * تستدعي RPC: create_self_service_trial، ثم تُكمل تسجيل الدخول تلقائياً.
 */
import React, { useState } from 'react';
import {
  Sparkles, Building2, User, Users, Phone, MessageCircle,
  Loader2, CheckCircle2, AlertCircle, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { sanitizeText, sanitizePhone } from '@/lib/validation';
import { clearAuthCache } from '@/lib/authCache';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface SelfServiceTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFullName?: string;
}

interface FormState {
  fullName: string;
  orgName: string;
  distributorsCount: string;
  phone: string;
  whatsapp: string;
  whatsappSameAsPhone: boolean;
}

const SelfServiceTrialModal: React.FC<SelfServiceTrialModalProps> = ({
  isOpen, onClose, onSuccess, defaultFullName = '',
}) => {
  const [form, setForm] = useState<FormState>({
    fullName: defaultFullName,
    orgName: '',
    distributorsCount: '',
    phone: '',
    whatsapp: '',
    whatsappSameAsPhone: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fullName = sanitizeText(form.fullName);
    const orgName = sanitizeText(form.orgName);
    const distributorsCount = parseInt(form.distributorsCount, 10);
    const phone = sanitizePhone(form.phone);
    const whatsapp = form.whatsappSameAsPhone ? phone : sanitizePhone(form.whatsapp);

    // Client validation
    if (!fullName || fullName.length < 2) { setError('الاسم الكامل مطلوب (حرفان على الأقل)'); return; }
    if (!orgName || orgName.length < 2) { setError('اسم الشركة مطلوب (حرفان على الأقل)'); return; }
    if (!distributorsCount || distributorsCount < 1 || distributorsCount > 500) {
      setError('عدد الموزعين يجب أن يكون بين 1 و 500'); return;
    }
    if (!phone || phone.length < 6) { setError('رقم الهاتف غير صحيح'); return; }
    if (!whatsapp || whatsapp.length < 6) { setError('رقم الواتساب غير صحيح'); return; }

    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_self_service_trial', {
        p_full_name: fullName,
        p_org_name: orgName,
        p_distributors_count: distributorsCount,
        p_phone: phone,
        p_whatsapp: whatsapp,
      });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; message?: string; error?: string };
      if (!result?.success) {
        setError(result?.message || 'فشل إنشاء الحساب التجريبي');
        return;
      }
      // Clear any cached auth so fresh profile is fetched
      clearAuthCache();
      logger.info('[SELF_TRIAL] Trial account created successfully', 'SelfServiceTrial');
      onSuccess();
    } catch (err: any) {
      logger.error('Self-service trial creation failed', 'SelfServiceTrial', { error: err?.message });
      setError(err?.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: confirmation screen
  if (!acknowledged) {
    return (
      <FullScreenModal
        isOpen={isOpen}
        onClose={onClose}
        title="حساب تجريبي مجاني"
        icon={<Sparkles className="w-5 h-5" />}
        headerColor="primary"
        footer={
          <div className="space-y-2">
            <button
              onClick={() => setAcknowledged(true)}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
            >
              متابعة <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-muted text-muted-foreground rounded-2xl font-bold text-sm hover:bg-muted/80"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-3">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground">على وشك إنشاء حسابك التجريبي 🎉</h3>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground text-sm">15 يوم مجاناً</p>
                <p className="text-xs text-muted-foreground mt-0.5">دون أي التزامات أو بطاقة ائتمان</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground text-sm">جميع المميزات مفتوحة</p>
                <p className="text-xs text-muted-foreground mt-0.5">إدارة الموزعين، المبيعات، المخزون والمحاسبة</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground text-sm">دخول تلقائي بعد التسجيل</p>
                <p className="text-xs text-muted-foreground mt-0.5">يبدأ حسابك مباشرة بعد إكمال البيانات</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground px-4">
            سنطلب منك بعض المعلومات الأساسية عن شركتك في الخطوة التالية.
          </p>
        </div>
      </FullScreenModal>
    );
  }

  // Step 2: form
  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title="بيانات الحساب التجريبي"
      icon={<Building2 className="w-5 h-5" />}
      headerColor="primary"
      footer={
        <button
          type="submit"
          form="self-trial-form"
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإنشاء...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> إنشاء الحساب التجريبي</>
          )}
        </button>
      }
    >
      <form id="self-trial-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <Field
          icon={<User className="w-4 h-4 text-primary" />}
          label="الاسم الكامل"
          required
        >
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="مثال: محمد أحمد"
            maxLength={100}
            autoComplete="name"
            disabled={loading}
            className="input-field"
          />
        </Field>

        {/* Org name */}
        <Field
          icon={<Building2 className="w-4 h-4 text-primary" />}
          label="اسم الشركة"
          required
        >
          <input
            type="text"
            value={form.orgName}
            onChange={(e) => update('orgName', e.target.value)}
            placeholder="مثال: شركة النور للتوزيع"
            maxLength={100}
            autoComplete="organization"
            disabled={loading}
            className="input-field"
          />
        </Field>

        {/* Distributors count */}
        <Field
          icon={<Users className="w-4 h-4 text-primary" />}
          label="عدد الموزعين"
          required
          hint="كم عدد الموزعين/المندوبين العاملين لديك؟"
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={form.distributorsCount}
            onChange={(e) => update('distributorsCount', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="مثال: 5"
            disabled={loading}
            className="input-field text-center"
            dir="ltr"
          />
        </Field>

        {/* Phone */}
        <Field
          icon={<Phone className="w-4 h-4 text-primary" />}
          label="رقم الهاتف"
          required
        >
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+963 9XX XXX XXX"
            maxLength={20}
            autoComplete="tel"
            disabled={loading}
            className="input-field"
            dir="ltr"
          />
        </Field>

        {/* WhatsApp */}
        <Field
          icon={<MessageCircle className="w-4 h-4 text-success" />}
          label="رقم الواتساب"
          required
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={form.whatsappSameAsPhone}
                onChange={(e) => update('whatsappSameAsPhone', e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-xs font-bold text-muted-foreground">
                نفس رقم الهاتف
              </span>
            </label>
            {!form.whatsappSameAsPhone && (
              <input
                type="tel"
                inputMode="tel"
                value={form.whatsapp}
                onChange={(e) => update('whatsapp', e.target.value)}
                placeholder="+963 9XX XXX XXX"
                maxLength={20}
                disabled={loading}
                className="input-field"
                dir="ltr"
              />
            )}
          </div>
        </Field>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2 leading-relaxed">
          بإنشائك للحساب فإنك توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
      </form>
    </FullScreenModal>
  );
};

// ============================================
// Field wrapper
// ============================================
interface FieldProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ icon, label, required, hint, children }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm font-bold text-foreground">
      {icon}
      {label}
      {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground px-1">{hint}</p>}
  </div>
);

export default SelfServiceTrialModal;
