import React from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon } from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import AIAssistant from '@/features/ai/components/AIAssistant';

interface Props {
  /** Title displayed in the centered identity badge (e.g. user name) */
  title: string;
  /** Optional small subtitle shown below the title (e.g. organization or role) */
  subtitle?: string;
  /** Icon shown on the leading side of the identity badge */
  Icon: LucideIcon;
  /** Show notification center on the start side (default true) */
  showNotifications?: boolean;
  /** Show AI assistant on the end side (default true) */
  showAI?: boolean;
  /** Optional custom node to render on the end side (replaces AI when provided) */
  endSlot?: React.ReactNode;
}

/**
 * Generic native-style app header with safe-area handling, glass tint behind notch,
 * and a centered identity badge — same visual language as the Owner dashboard.
 */
const AppHeader: React.FC<Props> = ({
  title,
  subtitle,
  Icon,
  showNotifications = true,
  showAI = true,
  endSlot,
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <>
      {/* Status-bar tint behind OS status bar / notch */}
      <div
        aria-hidden
        className="fixed top-0 inset-x-0 z-50 pointer-events-none"
        style={{
          height: 'env(safe-area-inset-top, 0px)',
          background: 'var(--card-glass-bg)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        }}
      />

      <header
        className="sticky top-0 z-40 w-full"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          background: 'var(--card-glass-bg)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          borderBottom: '1px solid var(--card-glass-border)',
          boxShadow:
            '0 1px 0 0 hsl(var(--foreground) / 0.02), 0 6px 24px -16px hsl(var(--foreground) / 0.18)',
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="max-w-lg mx-auto h-[52px] px-3 flex items-center justify-between gap-2 relative">
          {/* Start slot — Notifications */}
          <div className="flex-shrink-0 relative">
            {showNotifications ? <NotificationCenter /> : <div className="w-10 h-10" />}
          </div>

          {/* Identity (absolutely centered) */}
          <div className="absolute inset-x-0 mx-auto flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full pointer-events-auto"
              style={{
                background: 'hsl(var(--primary) / 0.06)',
                border: '1px solid hsl(var(--primary) / 0.10)',
                maxWidth: '62vw',
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
                  boxShadow: '0 2px 8px -2px hsl(var(--primary) / 0.45)',
                }}
              >
                <Icon className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 leading-none">
                <p className="font-bold text-foreground text-[12.5px] leading-[1.1] truncate">
                  {title}
                </p>
                {subtitle && (
                  <p className="text-[9.5px] text-muted-foreground leading-[1.1] truncate mt-[1px]">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* End slot — AI / custom */}
          <div className="flex-shrink-0 relative">
            {endSlot ?? (showAI ? <AIAssistant className="!p-2 !rounded-xl" /> : <div className="w-10 h-10" />)}
          </div>
        </div>
      </header>
    </>
  );
};

export default AppHeader;
