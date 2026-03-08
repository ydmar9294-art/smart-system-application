/**
 * DeviceRevokedScreen - WhatsApp-style device session takeover screen
 * 
 * Shown immediately when another device logs into the same account.
 * Blocks all interaction until user acknowledges and is redirected to login.
 * 
 * Flow:
 *   1. Full-screen overlay appears instantly with animation
 *   2. Shows phone icon + clear message explaining what happened
 *   3. User taps "OK" → local session cleared → redirected to login
 */
import React, { useEffect, useState } from 'react';
import { Smartphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface DeviceRevokedScreenProps {
  deviceName?: string;
  onAcknowledge: () => void;
}

const DeviceRevokedScreen: React.FC<DeviceRevokedScreenProps> = ({
  deviceName,
  onAcknowledge,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Staggered entrance animation
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[99999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Dimmed overlay pulse */}
      <div className="absolute inset-0 bg-destructive/5 animate-pulse pointer-events-none" />

      <div
        className={`relative flex flex-col items-center gap-6 max-w-sm transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Icon cluster */}
        <div className="relative">
          {/* Outer ring pulse */}
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-destructive/10 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-destructive/15 flex items-center justify-center border-2 border-destructive/30">
            <Smartphone className="w-10 h-10 text-destructive" strokeWidth={1.5} />
          </div>
          {/* Shield badge */}
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-background border-2 border-destructive/40 flex items-center justify-center shadow-lg">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-xl font-black text-foreground leading-relaxed">
            {isArabic
              ? 'تم تسجيل الدخول من جهاز آخر'
              : 'Logged in from another device'}
          </h1>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-[280px] mx-auto">
            {isArabic
              ? 'تم فتح حسابك على جهاز آخر. لا يمكن استخدام نفس الحساب على جهازين في نفس الوقت.'
              : 'Your account was opened on another device. You cannot use the same account on two devices simultaneously.'}
          </p>
          {deviceName && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {isArabic ? `الجهاز الجديد: ${deviceName}` : `New device: ${deviceName}`}
            </p>
          )}
        </div>

        {/* WhatsApp-style info box */}
        <div className="w-full bg-muted/50 rounded-xl p-4 border border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isArabic
              ? 'إذا لم تكن أنت من قام بذلك، قم بتغيير كلمة المرور فوراً لحماية حسابك.'
              : 'If this wasn\'t you, change your password immediately to protect your account.'}
          </p>
        </div>

        {/* Action button */}
        <Button
          onClick={onAcknowledge}
          className="w-full h-12 text-base font-bold rounded-xl shadow-lg"
          variant="destructive"
        >
          {isArabic ? 'حسناً' : 'OK'}
        </Button>
      </div>
    </div>
  );
};

export default DeviceRevokedScreen;
