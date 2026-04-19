import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import AIAssistant from '@/features/ai/components/AIAssistant';

interface Props {
  userName?: string;
  orgName?: string;
}

const OwnerCompactHeader: React.FC<Props> = ({ userName, orgName }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--card-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
        WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
        borderBottom: '1px solid var(--card-glass-border)',
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-lg mx-auto h-14 px-3 flex items-center justify-between gap-2">
        {/* Notifications */}
        <div className="flex-shrink-0">
          <NotificationCenter />
        </div>

        {/* Identity */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0 text-center">
            <p className="font-bold text-foreground text-[13px] leading-tight truncate">
              {userName || t('roles.owner')}
            </p>
            {orgName && (
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {orgName}
              </p>
            )}
          </div>
        </div>

        {/* AI */}
        <div className="flex-shrink-0">
          <AIAssistant className="!p-2 !rounded-xl" />
        </div>
      </div>
    </header>
  );
};

export default OwnerCompactHeader;
