/**
 * AccountTypeChoice — يسأل المستخدم: صاحب شركة أم موظف؟
 * يعرض بعد تسجيل الدخول لمن لا يملك حساباً مفعّلاً.
 */
import React from 'react';
import { Building2, UserCheck, Sparkles, LogOut } from 'lucide-react';

interface AccountTypeChoiceProps {
  fullName: string;
  email: string;
  onChooseOwner: () => void;
  onChooseEmployee: () => void;
  onLogout: () => void;
}

const AccountTypeChoice: React.FC<AccountTypeChoiceProps> = ({
  fullName, email, onChooseOwner, onChooseEmployee, onLogout,
}) => {
  return (
    <div className="space-y-5">
      {/* User badge */}
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-2xl border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{fullName || email}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-black text-foreground">أهلاً بك 👋</h3>
        <p className="text-xs text-muted-foreground">اختر نوع حسابك للمتابعة</p>
      </div>

      {/* Owner choice */}
      <button
        onClick={onChooseOwner}
        className="w-full p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 active:scale-[0.98] transition-all duration-200 hover:border-primary/40 hover:shadow-lg text-right"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground text-base">صاحب شركة</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              إنشاء حساب تجريبي مجاني لمدة <span className="font-black text-primary">15 يوم</span>
            </p>
          </div>
        </div>
      </button>

      {/* Employee choice */}
      <button
        onClick={onChooseEmployee}
        className="w-full p-4 rounded-2xl bg-gradient-to-br from-success/10 to-success/5 border-2 border-success/20 active:scale-[0.98] transition-all duration-200 hover:border-success/40 hover:shadow-lg text-right"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-success/15 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground text-base">موظف لدى شركة</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              لديك كود تفعيل من مدير الشركة
            </p>
          </div>
        </div>
      </button>

      <p className="text-center text-[10px] text-muted-foreground pt-2">
        يمكنك تغيير اختيارك لاحقاً عبر تسجيل الخروج وإعادة الدخول
      </p>
    </div>
  );
};

export default AccountTypeChoice;
