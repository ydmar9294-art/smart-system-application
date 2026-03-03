/**
 * LogoutScreen - Full-screen professional goodbye screen
 * Shown during logout to provide a premium experience.
 */
import React from 'react';
import AppLogo from '@/components/ui/AppLogo';

const LogoutScreen: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-8 max-w-xs">
        {/* Logo with pulse */}
        <div className="animate-logo-glow">
          <div className="rounded-[1.5rem] p-3 logo-glass-container">
            <AppLogo size={72} />
          </div>
        </div>

        {/* Spinner */}
        <div className="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin" />

        {/* Message */}
        <div className="space-y-3">
          <p className="text-xl font-black text-foreground leading-relaxed">
            نشكرك لثقتك بنا 🤍
          </p>
          <p className="text-sm text-muted-foreground font-bold">
            نتطلع لرؤيتك قريباً
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogoutScreen;
