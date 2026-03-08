/**
 * GuestBanner - Persistent top banner in guest mode showing current role and exit button
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, LogOut } from 'lucide-react';
import { useGuest } from '@/store/GuestContext';

const GuestBanner: React.FC = () => {
  const { t } = useTranslation();
  const { isGuest, guestRole, exitGuest } = useGuest();

  if (!isGuest || !guestRole) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9998] pt-[env(safe-area-inset-top,0px)]">
      <div className="bg-primary/90 backdrop-blur-xl text-primary-foreground px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 opacity-80" />
          <span className="text-xs font-bold">
            {t('guest.previewMode')} — {t(`guest.roles.${guestRole.label}`)}
          </span>
        </div>
        <button
          onClick={exitGuest}
          className="flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1 active:scale-95 transition-transform"
        >
          <LogOut className="w-3 h-3" />
          {t('guest.exit')}
        </button>
      </div>
    </div>
  );
};

export default GuestBanner;
