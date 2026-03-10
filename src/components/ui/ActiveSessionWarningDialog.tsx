/**
 * ActiveSessionWarningDialog
 * Shown when a user logs in and their account is already active on another device.
 * User must confirm to continue (which logs out the other device) or cancel.
 */
import React from 'react';
import { Smartphone, AlertTriangle, LogIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ActiveSessionWarningDialogProps {
  open: boolean;
  activeDevices?: Array<{ device_name: string; last_seen: string }>;
  onContinue: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ActiveSessionWarningDialog: React.FC<ActiveSessionWarningDialogProps> = ({
  open,
  activeDevices,
  onContinue,
  onCancel,
  loading = false,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center p-6"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} />

      {/* Dialog */}
      <div className="relative z-10 max-w-sm w-full bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 fade-in duration-300">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <AlertTriangle className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title & Description */}
        <div className="text-center space-y-3">
          <h2 className="text-xl font-black text-foreground leading-tight">
            {isArabic
              ? 'الحساب نشط على جهاز آخر'
              : 'Account active on another device'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isArabic
              ? 'هذا الحساب مسجّل الدخول حالياً على جهاز آخر. المتابعة ستؤدي لتسجيل الخروج من جميع الأجهزة الأخرى.'
              : 'This account is currently logged in on another device. Continuing will log out all other devices.'}
          </p>
        </div>

        {/* Active devices list */}
        {activeDevices && activeDevices.length > 0 && (
          <div className="bg-muted/60 rounded-2xl p-3 space-y-2">
            {activeDevices.map((device, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground font-bold">{device.device_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onContinue}
            disabled={loading}
            className="w-full h-12 text-base font-black rounded-2xl gap-2"
            variant="default"
            size="lg"
          >
            <LogIn className="w-5 h-5" />
            {loading
              ? (isArabic ? 'جاري المتابعة...' : 'Continuing...')
              : (isArabic ? 'متابعة وتسجيل الخروج من الأجهزة الأخرى' : 'Continue & log out other devices')}
          </Button>
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="ghost"
            className="w-full h-11 text-sm font-bold rounded-2xl gap-2"
          >
            <X className="w-4 h-4" />
            {isArabic ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionWarningDialog;
