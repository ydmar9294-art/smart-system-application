/**
 * LoginHelpModal — illustrated demo for how to sign in.
 * Two tabs: "ترخيص تجريبي (صاحب شركة)" and "موظف تابع لشركة".
 * Uses inline SVG illustrations (no image assets).
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, LogIn, Building2, UserCheck, KeyRound,
  Sparkles, Rocket, ShieldCheck, HelpCircle,
} from 'lucide-react';
import { useBackButton } from '@/hooks/useBackButton';

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const trialSlides: Slide[] = [
  {
    icon: <LogIn className="w-10 h-10" />,
    title: '1) اضغط «تسجيل الدخول عبر Google»',
    body: 'استخدم حساب Google الخاص بك. لن نطلب كلمة سر — نستخدم حسابك الآمن مباشرة.',
  },
  {
    icon: <Building2 className="w-10 h-10" />,
    title: '2) اختر «صاحب شركة»',
    body: 'بعد الدخول لأول مرة يسألك التطبيق: صاحب شركة أم موظف؟ اختر «صاحب شركة».',
  },
  {
    icon: <Sparkles className="w-10 h-10" />,
    title: '3) أدخل بيانات منشأتك',
    body: 'اسم المنشأة، العملة، وسعر صرف الدولار. كلها قابلة للتعديل لاحقاً.',
  },
  {
    icon: <Rocket className="w-10 h-10" />,
    title: '4) تجربة مجانية 15 يوم 🎉',
    body: 'سيتم إنشاء حسابك التجريبي فوراً وتنتقل للوحة الإدارة. بعد التجربة يمكنك التجديد عبر شام كاش.',
  },
];

const employeeSlides: Slide[] = [
  {
    icon: <LogIn className="w-10 h-10" />,
    title: '1) اضغط «تسجيل الدخول عبر Google»',
    body: 'استخدم حساب Google الخاص بك للدخول لأول مرة.',
  },
  {
    icon: <UserCheck className="w-10 h-10" />,
    title: '2) اختر «موظف لدى شركة»',
    body: 'عند سؤالك عن نوع الحساب، اختر «موظف لدى شركة».',
  },
  {
    icon: <KeyRound className="w-10 h-10" />,
    title: '3) أدخل كود التفعيل (7 محارف)',
    body: 'الإدارة ستعطيك كوداً مكوّناً من 7 محارف. أدخله ليتفعّل حسابك على دورك (موزع/محاسب).',
  },
  {
    icon: <ShieldCheck className="w-10 h-10" />,
    title: '4) جاهز للعمل ✅',
    body: 'بعد التفعيل تدخل مباشرة إلى واجهتك المخصّصة، وتبدأ بالعمل حتى بدون إنترنت.',
  },
];

type Tab = 'trial' | 'employee';

interface Props {
  onClose: () => void;
}

const LoginHelpModal: React.FC<Props> = ({ onClose }) => {
  const [tab, setTab] = useState<Tab>('trial');
  const [step, setStep] = useState(0);

  useBackButton(() => { onClose(); return true; }, true);

  const slides = tab === 'trial' ? trialSlides : employeeSlides;
  const slide = slides[step];
  const isFirst = step === 0;
  const isLast = step === slides.length - 1;

  const switchTab = (t: Tab) => { setTab(t); setStep(0); };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
      style={{ zIndex: 10001 }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="كيف أسجّل الدخول؟"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-3xl border border-border/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-foreground">كيف أسجّل الدخول؟</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/60 active:scale-95 transition"
            aria-label="إغلاق"
            type="button"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-5 mb-3 grid grid-cols-2 bg-muted/50 rounded-2xl p-1 gap-1">
          <button
            onClick={() => switchTab('trial')}
            className={`py-2.5 rounded-xl text-xs font-black transition ${
              tab === 'trial' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
            type="button"
          >
            صاحب شركة (تجريبي)
          </button>
          <button
            onClick={() => switchTab('employee')}
            className={`py-2.5 rounded-xl text-xs font-black transition ${
              tab === 'employee' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
            type="button"
          >
            موظف تابع لشركة
          </button>
        </div>

        {/* Illustration */}
        <div className="mx-5 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 aspect-[16/9] flex items-center justify-center text-primary">
          <div className="animate-in fade-in zoom-in-95 duration-200" key={`${tab}-${step}`}>
            {slide.icon}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-4">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 pt-3 pb-2 text-center">
          <h4 className="text-base font-black text-foreground mb-1.5">{slide.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-5">
          <button
            onClick={onClose}
            className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-2"
            type="button"
          >
            إغلاق
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setStep(i => Math.max(0, i - 1))}
            disabled={isFirst}
            className="w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            type="button"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => (isLast ? onClose() : setStep(i => i + 1))}
            className="min-w-24 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm px-4 flex items-center justify-center gap-1 active:scale-95 transition"
            type="button"
          >
            {isLast ? 'فهمت' : (<>التالي<ChevronLeft className="w-4 h-4" /></>)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LoginHelpModal;
