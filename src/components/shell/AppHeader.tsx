import React from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon } from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import AIAssistant from '@/features/ai/components/AIAssistant';
import { useScrollShrink } from '@/hooks/useScrollShrink';

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
  const shrunk = useScrollShrink(8);

  return (
    <>
      {/* Status-bar tint behind OS status bar / notch */}
      <div
        aria-hidden
        className="fixed top-0 inset-x-0 z-50 pointer-events-none transition-[backdrop-filter] duration-300"
        style={{
          height: 'env(safe-area-inset-top, 0px)',
          background: shrunk
            ? 'var(--card-glass-bg)'
            : 'color-mix(in oklab, var(--card-glass-bg) 75%, transparent)',
          backdropFilter: shrunk ? 'blur(34px) saturate(200%)' : 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: shrunk ? 'blur(34px) saturate(200%)' : 'blur(24px) saturate(180%)',
        }}
      />

      <header
        data-shrunk={shrunk}
        className="app-header-pro sticky top-0 z-40 w-full"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Soft primary glow that strengthens after scroll */}
        <span aria-hidden className="app-header-pro__glow" />

        <div className="app-header-pro__row max-w-lg mx-auto px-3 flex items-center justify-between gap-2 relative">
          {/* Start slot — Notifications */}
          <div className="flex-shrink-0 relative">
            {showNotifications ? <NotificationCenter /> : <div className="w-10 h-10" />}
          </div>

          {/* Identity (absolutely centered) */}
          <div className="absolute inset-x-0 mx-auto flex items-center justify-center pointer-events-none">
            <div
              className="app-header-pro__pill flex items-center gap-2 rounded-full pointer-events-auto"
              style={{ maxWidth: '62vw' }}
            >
              <div className="app-header-pro__icon rounded-full flex items-center justify-center flex-shrink-0">
                <Icon className="text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 leading-none">
                <p className="app-header-pro__title font-bold text-foreground leading-[1.1] truncate">
                  {title}
                </p>
                {subtitle && (
                  <p className="app-header-pro__subtitle text-muted-foreground leading-[1.1] truncate mt-[1px]">
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
