import React from 'react';
import ReactDOM from 'react-dom';
import { X, Eye, Building2, BarChart3, Calculator, Warehouse, Truck } from 'lucide-react';
import { GUEST_ROLES, GuestRole } from '@/store/GuestContext';

interface GuestRoleSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (role: GuestRole) => void;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  'المالك': <Building2 className="w-6 h-6" />,
  'مدير المبيعات': <BarChart3 className="w-6 h-6" />,
  'المحاسب': <Calculator className="w-6 h-6" />,
  'أمين المستودع': <Warehouse className="w-6 h-6" />,
  'الموزع الميداني': <Truck className="w-6 h-6" />,
};

const ROLE_COLORS: Record<string, string> = {
  'المالك': 'from-primary to-primary/70',
  'مدير المبيعات': 'from-success to-success/70',
  'المحاسب': 'from-warning to-warning/70',
  'أمين المستودع': 'from-[hsl(280,60%,55%)] to-[hsl(280,60%,40%)]',
  'الموزع الميداني': 'from-destructive to-destructive/70',
};

const GuestRoleSelector: React.FC<GuestRoleSelectorProps> = ({ open, onClose, onSelect }) => {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md mx-2 mb-2 sm:mb-0 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div
          className="rounded-[2rem] overflow-hidden shadow-2xl"
          style={{
            background: 'var(--card-glass-bg)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: '1px solid var(--card-glass-border)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">وضع المعاينة</h3>
                <p className="text-xs text-muted-foreground">اختر الدور لاستعراض الواجهة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Role cards */}
          <div className="px-5 pb-6 space-y-2.5">
            {GUEST_ROLES.map((gr) => (
              <button
                key={gr.label}
                onClick={() => onSelect(gr)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                style={{
                  background: 'var(--card-glass-bg)',
                  border: '1px solid var(--card-glass-border)',
                }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ROLE_COLORS[gr.label]} flex items-center justify-center text-white shadow-lg`}>
                  {ROLE_ICONS[gr.label]}
                </div>
                <div className="flex-1 text-start">
                  <p className="font-bold text-foreground text-sm">{gr.label}</p>
                  <p className="text-[11px] text-muted-foreground">معاينة لوحة التحكم</p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>

          {/* Footer note */}
          <div className="px-6 pb-5">
            <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
              وضع المعاينة للقراءة فقط — جميع العمليات معطّلة
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuestRoleSelector;
