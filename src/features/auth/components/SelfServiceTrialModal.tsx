/**
 * SelfServiceTrialModal — نافذة Native لإنشاء حساب تجريبي ذاتي (15 يوم).
 * تُجمع: الاسم الكامل، اسم الشركة، عدد الموزعين، رقم الهاتف، رقم الواتساب،
 * بالإضافة إلى العملة الأساسية للمنشأة + عملة ثانوية اختيارية وسعر صرفها.
 * تستدعي RPC: create_self_service_trial، ثم تُكمل تسجيل الدخول تلقائياً.
 */
import React, { useState, useMemo } from 'react';
import {
  Sparkles, Building2, User, Users, Phone, MessageCircle,
  Loader2, CheckCircle2, AlertCircle, ArrowRight, Coins, ArrowRightLeft,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { sanitizeText, sanitizePhone } from '@/lib/validation';
import { clearAuthCache } from '@/lib/authCache';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { COMMON_CURRENCIES } from '@/constants/currencies';

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
  baseCurrency: string;          // currency code, required
  addSecondary: boolean;
  secondaryCurrency: string;     // currency code (when addSecondary)
  exchangeRate: string;          // 1 base = X secondary
}

type Step = 'intro' | 'company' | 'currency';

const SelfServiceTrialModal: React.FC<SelfServiceTrialModalProps> = ({
  isOpen, onClose, onSuccess, defaultFullName = '',
}) => {
  const [step, setStep] = useState<Step>('intro');
  const [form, setForm] = useState<FormState>({
    fullName: defaultFullName,
    orgName: '',
    distributorsCount: '',
    phone: '',
    whatsapp: '',
    whatsappSameAsPhone: false,
    baseCurrency: '',
    addSecondary: false,
    secondaryCurrency: '',
    exchangeRate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const secondaryOptions = useMemo(
    () => COMMON_CURRENCIES.filter(c => c.code !== form.baseCurrency),
    [form.baseCurrency]
  );

  const validateCompanyStep = (): string | null => {
    const fullName = sanitizeText(form.fullName);
    const orgName = sanitizeText(form.orgName);
    const distributorsCount = parseInt(form.distributorsCount, 10);
    const phone = sanitizePhone(form.phone);
    const whatsapp = form.whatsappSameAsPhone ? phone : sanitizePhone(form.whatsapp);
    if (!fullName || fullName.length < 2) return 'الاسم الكامل مطلوب (حرفان على الأقل)';
    if (!orgName || orgName.length < 2) return 'اسم الشركة مطلوب (حرفان على الأقل)';
    if (!distributorsCount || distributorsCount < 1 || distributorsCount > 500) return 'عدد الموزعين يجب أن يكون بين 1 و 500';
    if (!phone || phone.length < 6) return 'رقم الهاتف غير صحيح';
    if (!whatsapp || whatsapp.length < 6) return 'رقم الواتساب غير صحيح';
    return null;
  };

  const handleCompanyContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validateCompanyStep();
    if (err) { setError(err); return; }
    setStep('currency');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.baseCurrency) { setError('يرجى اختيار العملة الأساسية للمنشأة'); return; }
    const basePreset = COMMON_CURRENCIES.find(c => c.code === form.baseCurrency);
    if (!basePreset) { setError('عملة أساسية غير صحيحة'); return; }

    let secondaryPreset: typeof basePreset | undefined;
    let rateNum: number | null = null;
    if (form.addSecondary) {
      if (!form.secondaryCurrency || form.secondaryCurrency === form.baseCurrency) {
        setError('اختر عملة ثانوية مختلفة عن العملة الأساسية'); return;
      }
      secondaryPreset = COMMON_CURRENCIES.find(c => c.code === form.secondaryCurrency);
      if (!secondaryPreset) { setError('عملة ثانوية غير صحيحة'); return; }
      rateNum = parseFloat(form.exchangeRate);
      if (!isFinite(rateNum) || rateNum <= 0) {
        setError(`سعر الصرف غير صحيح (1 ${basePreset.code} = ? ${secondaryPreset.code})`); return;
      }
    }

    const fullName = sanitizeText(form.fullName);
    const orgName = sanitizeText(form.orgName);
    const distributorsCount = parseInt(form.distributorsCount, 10);
    const phone = sanitizePhone(form.phone);
    const whatsapp = form.whatsappSameAsPhone ? phone : sanitizePhone(form.whatsapp);

    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_self_service_trial', {
        p_full_name: fullName,
        p_org_name: orgName,
        p_distributors_count: distributorsCount,
        p_phone: phone,
        p_whatsapp: whatsapp,
        p_base_currency_code: basePreset.code,
        p_base_currency_name: basePreset.name_ar,
        p_base_currency_symbol: basePreset.symbol,
        p_secondary_currency_code: secondaryPreset?.code ?? null,
        p_secondary_currency_name: secondaryPreset?.name_ar ?? null,
        p_secondary_currency_symbol: secondaryPreset?.symbol ?? null,
        p_exchange_rate: rateNum,
      });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; message?: string; error?: string };
      if (!result?.success) {
        setError(result?.message || 'فشل إنشاء الحساب التجريبي');
        return;
      }
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

  // ---------------------------------------------------------------
  // Step 1: intro
  // ---------------------------------------------------------------
  if (step === 'intro') {
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
              onClick={() => setStep('company')}
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
            سنطلب منك بعض المعلومات الأساسية عن شركتك ثم اختيار العملة في الخطوة التالية.
          </p>
        </div>
      </FullScreenModal>
    );
  }

  // ---------------------------------------------------------------
  // Step 2: company info
  // ---------------------------------------------------------------
  if (step === 'company') {
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
            form="self-trial-company-form"
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
          >
            <ArrowRight className="w-5 h-5 rotate-180" /> متابعة لاختيار العملة
          </button>
        }
      >
        <form id="self-trial-company-form" onSubmit={handleCompanyContinue} className="space-y-4">
          <Field icon={<User className="w-4 h-4 text-primary" />} label="الاسم الكامل" required>
            <input type="text" value={form.fullName} onChange={(e) => update('fullName', e.target.value)}
              placeholder="مثال: محمد أحمد" maxLength={100} autoComplete="name" className="input-field" />
          </Field>

          <Field icon={<Building2 className="w-4 h-4 text-primary" />} label="اسم الشركة" required>
            <input type="text" value={form.orgName} onChange={(e) => update('orgName', e.target.value)}
              placeholder="مثال: شركة النور للتوزيع" maxLength={100} autoComplete="organization" className="input-field" />
          </Field>

          <Field icon={<Users className="w-4 h-4 text-primary" />} label="عدد الموزعين" required
            hint="كم عدد الموزعين/المندوبين العاملين لديك؟">
            <input type="number" inputMode="numeric" min={1} max={500}
              value={form.distributorsCount}
              onChange={(e) => update('distributorsCount', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="مثال: 5" className="input-field text-center" dir="ltr" />
          </Field>

          <Field icon={<Phone className="w-4 h-4 text-primary" />} label="رقم الهاتف" required>
            <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
              placeholder="+963 9XX XXX XXX" maxLength={20} autoComplete="tel" className="input-field" dir="ltr" />
          </Field>

          <Field icon={<MessageCircle className="w-4 h-4 text-success" />} label="رقم الواتساب" required>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                <input type="checkbox" checked={form.whatsappSameAsPhone}
                  onChange={(e) => update('whatsappSameAsPhone', e.target.checked)}
                  className="w-4 h-4 rounded accent-primary" />
                <span className="text-xs font-bold text-muted-foreground">نفس رقم الهاتف</span>
              </label>
              {!form.whatsappSameAsPhone && (
                <input type="tel" inputMode="tel" value={form.whatsapp}
                  onChange={(e) => update('whatsapp', e.target.value)}
                  placeholder="+963 9XX XXX XXX" maxLength={20} className="input-field" dir="ltr" />
              )}
            </div>
          </Field>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}
        </form>
      </FullScreenModal>
    );
  }

  // ---------------------------------------------------------------
  // Step 3: currency
  // ---------------------------------------------------------------
  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title="إعدادات العملة"
      icon={<Coins className="w-5 h-5" />}
      headerColor="primary"
      footer={
        <div className="space-y-2">
          <button
            type="submit"
            form="self-trial-currency-form"
            disabled={loading}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإنشاء...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> إنشاء الحساب التجريبي</>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setStep('company'); setError(''); }}
            disabled={loading}
            className="w-full py-3 bg-muted text-muted-foreground rounded-2xl font-bold text-sm hover:bg-muted/80 disabled:opacity-50"
          >
            رجوع
          </button>
        </div>
      }
    >
      <form id="self-trial-currency-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
          <p className="font-bold text-foreground text-sm flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" /> العملة الأساسية للمنشأة
          </p>
          <p className="text-xs text-muted-foreground">
            ستكون هي عملة التسعير والمحاسبة الافتراضية. يمكنك إضافة عملات أخرى لاحقاً من إعدادات العملات.
          </p>
        </div>

        <Field icon={<Coins className="w-4 h-4 text-primary" />} label="العملة الأساسية" required>
          <select
            value={form.baseCurrency}
            onChange={(e) => update('baseCurrency', e.target.value)}
            className="input-field"
          >
            <option value="">— اختر العملة الأساسية —</option>
            {COMMON_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
            ))}
          </select>
        </Field>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.addSecondary}
              onChange={(e) => update('addSecondary', e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="font-bold text-foreground text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              إضافة عملة ثانوية وسعر صرفها (اختياري)
            </span>
          </label>

          {form.addSecondary && (
            <div className="space-y-3 pt-2">
              <Field icon={<Coins className="w-4 h-4 text-amber-500" />} label="العملة الثانوية" required>
                <select
                  value={form.secondaryCurrency}
                  onChange={(e) => update('secondaryCurrency', e.target.value)}
                  disabled={!form.baseCurrency}
                  className="input-field"
                >
                  <option value="">— اختر العملة الثانوية —</option>
                  {secondaryOptions.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
                  ))}
                </select>
              </Field>

              <Field
                icon={<ArrowRightLeft className="w-4 h-4 text-amber-500" />}
                label={`سعر الصرف (1 ${form.baseCurrency || '?'} = ? ${form.secondaryCurrency || '?'})`}
                required
                hint="مثال: إذا كانت العملة الأساسية SYP والعملة الثانوية USD وسعر الدولار 15000 ل.س، فالسعر هو 0.0000667"
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.000001"
                  min="0"
                  value={form.exchangeRate}
                  onChange={(e) => update('exchangeRate', e.target.value)}
                  placeholder="مثال: 0.0000667"
                  className="input-field text-center"
                  dir="ltr"
                />
              </Field>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">
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
