import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import { motion } from 'motion/react';

interface DashboardHeaderProps {
  userName: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBgClass?: string;
  rightActions?: React.ReactNode;
  onSettingsOpen?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  subtitle,
  icon,
  iconBgClass = 'bg-primary',
  rightActions,
  onSettingsOpen,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const greeting = isRTL ? `مرحباً، ${userName} 👋` : `Welcome, ${userName} 👋`;

  return (
    <header className="native-header safe-area-top" dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.div
        className="native-header-inner"
        initial={{ y: -40, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 }}
      >
        {/* Profile capsule */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 relative z-[2]">
          {icon && (
            <div className="native-header-avatar">
              <div className={`w-8 h-8 ${iconBgClass} rounded-full flex items-center justify-center`}>
                {icon}
              </div>
              <div className="absolute -bottom-0.5 -end-0.5 w-2 h-2 rounded-full bg-success border-[1.5px] border-background" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-black text-foreground text-[12px] leading-tight truncate">{greeting}</p>
            {subtitle && (
              <p className="text-[9px] text-muted-foreground font-bold mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 relative z-[2]">
          <div className="native-header-icon-btn">
            <NotificationCenter />
          </div>
          {rightActions}
          {onSettingsOpen && (
            <button
              onClick={onSettingsOpen}
              className="native-header-icon-btn"
              title={t('common.settings')}
            >
              <Settings className="w-[14px] h-[14px]" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </motion.div>
    </header>
  );
};
