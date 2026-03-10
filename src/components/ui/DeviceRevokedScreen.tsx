/**
 * DeviceRevokedScreen - WhatsApp-style device session takeover screen
 * 
 * Shown immediately when another device logs into the same account.
 * Auto-logs out after 3 seconds. No button needed.
 */
import React, { useEffect, useState } from 'react';
import { Smartphone, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeviceRevokedScreenProps {
  deviceName?: string;
  onAcknowledge: () => void;
}

const DeviceRevokedScreen: React.FC<DeviceRevokedScreenProps> = ({
  deviceName,
  onAcknowledge,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [showContent, setShowContent] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 150);
    return () => clearTimeout(t1);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 text-center"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)',
      }}
    >
      {/* Subtle animated background pulse */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--destructive)), transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
      </div>

      <div
        className={`relative flex flex-col items-center gap-8 max-w-sm transition-all duration-700 ease-out ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Icon */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20 shadow-lg shadow-destructive/5">
            <Smartphone className="w-12 h-12 text-destructive" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-10 h-10 rounded-full bg-background border-2 border-destructive/30 flex items-center justify-center shadow-md">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-4">
          <h1 className="text-2xl font-black text-foreground leading-tight tracking-tight">
            {isArabic
              ? 'تم تسجيل الدخول من جهاز آخر'
              : 'Logged in from another device'}
          </h1>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-[300px] mx-auto">
            {isArabic
              ? 'تم فتح حسابك على جهاز آخر. لأسباب أمنية سيتم تسجيل خروجك تلقائياً.'
              : 'Your account was opened on another device. For security reasons you will be logged out automatically.'}
          </p>
          {deviceName && (
            <div className="inline-flex items-center gap-2 bg-muted/80 rounded-full px-4 py-2 mx-auto">
              <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                {isArabic ? `الجهاز: ${deviceName}` : `Device: ${deviceName}`}
              </span>
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className="w-full bg-muted/60 rounded-2xl p-4 border border-border/40 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground/80 leading-relaxed font-bold">
            {isArabic
              ? `⏳ تسجيل الخروج تلقائياً خلال ${countdown} ثوانٍ...`
              : `⏳ Logging out automatically in ${countdown}s...`}
          </p>
        </div>

        {/* Security tip */}
        <div className="w-full bg-muted/60 rounded-2xl p-4 border border-border/40 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {isArabic
              ? '⚠️ إذا لم تكن أنت من قام بذلك، قم بتغيير كلمة المرور فوراً.'
              : '⚠️ If this wasn\'t you, change your password immediately.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceRevokedScreen;
