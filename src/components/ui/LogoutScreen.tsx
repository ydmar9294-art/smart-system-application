import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLogo from '@/components/ui/AppLogo';

const LogoutScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      dir="auto"
    >
      <div className="flex flex-col items-center gap-8 max-w-xs">
        <div className="animate-logo-glow">
          <AppLogo size={72} />
        </div>
        <div className="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin" />
        <div className="space-y-3">
          <p className="text-xl font-black text-foreground leading-relaxed">
            {t('logoutScreen.thankYou')}
          </p>
          <p className="text-sm text-muted-foreground font-bold">
            {t('logoutScreen.seeYou')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogoutScreen;
