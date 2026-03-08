import React from 'react';
import { LogOut, MessageCircle } from 'lucide-react';
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
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  subtitle,
  icon,
  iconBgClass = 'bg-primary',
  onLogout,
  loggingOut,
  rightActions,
}) => {
  return (
    <div className="dashboard-header">
      {/* Notification bell — absolute top-left */}
      <div className="absolute top-3 left-3 z-10">
        <NotificationCenter />
      </div>

      {/* Profile capsule */}
      <div className="flex justify-center pt-2 mb-3">
        <div className="glass-profile-capsule">
          <div className={`w-9 h-9 ${iconBgClass} rounded-full flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <div className="text-end">
            <p className="font-black text-foreground text-sm leading-tight">{userName}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 glass-action-bar">
          <AIAssistant className="!p-1.5 !rounded-lg" />
          <div className="w-px h-5 bg-border/50" />
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-gradient-to-br from-green-400 to-green-600 rounded-lg text-white hover:shadow-md transition-all active:scale-95"
            title="فريق الدعم"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
          {rightActions}
        </div>
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="glass-logout-btn"
          title="تسجيل الخروج"
        >
          <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
