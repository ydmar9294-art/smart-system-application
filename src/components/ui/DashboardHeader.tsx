import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Settings } from 'lucide-react';
import AIAssistant from '@/features/ai/components/AIAssistant';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import { SUPPORT_WHATSAPP_URL } from '@/constants';

interface DashboardHeaderProps {
  userName: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgClass?: string;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
  rightActions?: React.ReactNode;
  onSettingsOpen?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  subtitle,
  icon,
  iconBgClass = 'bg-primary',
  onLogout,
  loggingOut,
  rightActions,
  onSettingsOpen,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const greeting = isRTL ? `مرحباً، ${userName} 👋` : `Hello, ${userName} 👋`;

  return (
    <div className="native-header safe-area-top" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Main row: Profile + Actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {/* Profile capsule */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="native-header-avatar">
            <div className={`w-9 h-9 ${iconBgClass} rounded-xl flex items-center justify-center`}>
              {icon}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-foreground text-[13px] leading-tight truncate">{greeting}</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="native-header-action-pill">
            <AIAssistant className="!p-1 !rounded-lg" />
          </div>
          <div className="native-header-icon-btn">
            <NotificationCenter />
          </div>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="native-header-icon-btn native-header-icon-whatsapp"
            title={t('common.supportTeam')}
          >
            <MessageCircle className="w-[15px] h-[15px]" />
          </a>
          {onSettingsOpen && (
            <button
              onClick={onSettingsOpen}
              className="native-header-icon-btn"
              title={t('common.settings')}
            >
              <Settings className="w-[15px] h-[15px]" />
            </button>
          )}
          {rightActions}
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="native-header-edge" />
    </div>
  );
};
