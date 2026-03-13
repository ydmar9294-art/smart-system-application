/**
 * DeviceRevokedScreen
 * Shown on the OLD device when a new device logs in.
 * Displays a 3-second countdown then auto-logs out.
 */
import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeviceRevokedScreenProps {
  message?: string;
  onComplete: () => void;
}

const DeviceRevokedScreen: React.FC<DeviceRevokedScreenProps> = ({ message, onComplete }) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-background p-6"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 fade-in duration-300">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/20">
          <Smartphone className="w-12 h-12 text-destructive" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-foreground">
          {isArabic ? 'تم تسجيل الدخول من جهاز آخر' : 'Logged in from another device'}
        </h2>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {message || (isArabic
            ? 'تم تسجيل الدخول إلى حسابك من جهاز آخر. سيتم تسجيل خروجك تلقائياً.'
            : 'Your account was logged in from another device. You will be logged out automatically.')}
        </p>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-xl font-black text-destructive">{countdown}</span>
          </div>
          <p className="text-xs text-muted-foreground font-bold">
            {isArabic ? 'تسجيل الخروج خلال...' : 'Logging out in...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceRevokedScreen;
