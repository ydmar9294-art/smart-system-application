import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Settings, Sparkles } from 'lucide-react';
import AIAssistant from '@/features/ai/components/AIAssistant';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import { SUPPORT_WHATSAPP_URL } from '@/constants';
import { motion } from 'motion/react';

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
    <motion.div
      className="native-header safe-area-top"
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      {/* Status badge row — AI Active indicator */}
      <div className="flex items-center justify-center pt-2.5 pb-1 gap-2">
        <motion.div
          className="native-header-status-badge"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 18 }}
        >
          <div className="native-header-ai-dot" />
          <Sparkles className="w-2.5 h-2.5" />
          <span>{isRTL ? 'منصة الإنتاج الذكي' : 'AI Active'}</span>
        </motion.div>
      </div>

      {/* Main row: Profile + Actions */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2.5">
        {/* Profile capsule */}
        <motion.div
          className="flex items-center gap-3 min-w-0 flex-1"
          initial={{ x: isRTL ? 20 : -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="native-header-avatar">
            <div className={`w-10 h-10 ${iconBgClass} rounded-[1.25rem] flex items-center justify-center shadow-lg`}>
              {icon}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-foreground text-[14px] leading-tight truncate">{greeting}</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 truncate">{subtitle}</p>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex items-center gap-1.5 flex-shrink-0"
          initial={{ x: isRTL ? -20 : 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
        >
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
        </motion.div>
      </div>

      {/* Bottom accent line */}
      <div className="native-header-edge" />
    </motion.div>
  );
};
