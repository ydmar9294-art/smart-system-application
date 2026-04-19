import React from 'react';
import { LucideIcon, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHaptics } from '@/platform/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

export interface BottomNavItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface Props<T extends string> {
  /** Up to 4 primary tabs — a 5th "Settings" button is always appended */
  items: BottomNavItem<T>[];
  active: T | 'settings';
  onChange: (id: T) => void;
  onOpenSettings: () => void;
  /** Optional custom label for the settings tab (defaults to t('settings.title')) */
  settingsLabel?: string;
}

/**
 * Generic native-style floating bottom nav with glass surface, haptics and an
 * always-present settings button as the last item — same visual language as Owner.
 */
function AppBottomNav<T extends string>({
  items,
  active,
  onChange,
  onOpenSettings,
  settingsLabel,
}: Props<T>) {
  const { t } = useTranslation();
  const haptics = useHaptics();

  // Cap to 4 primary items; settings is always the 5th
  const primary = items.slice(0, 4);

  const handle = (id: T | 'settings') => {
    haptics.impact(ImpactStyle.Light);
    if (id === 'settings') onOpenSettings();
    else onChange(id);
  };

  const renderButton = (
    id: T | 'settings',
    label: string,
    Icon: LucideIcon,
    isActive: boolean,
  ) => (
    <button
      key={id}
      onClick={() => handle(id)}
      className="flex-1 relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-300 active:scale-90"
      aria-label={label}
    >
      <div
        className={`flex items-center justify-center transition-all duration-300 ${
          isActive ? 'text-primary scale-110' : 'text-muted-foreground'
        }`}
      >
        <Icon className="w-[22px] h-[22px]" />
      </div>
      <span
        className={`text-[10px] font-bold leading-tight transition-colors duration-200 ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      {isActive && <span className="absolute -top-0.5 w-1 h-1 rounded-full bg-primary" />}
    </button>
  );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-lg mx-auto px-3 pb-2 pointer-events-auto">
        <div
          className="rounded-3xl flex items-center justify-around px-1.5 py-1.5"
          style={{
            background: 'var(--card-glass-bg)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--card-glass-border)',
            boxShadow: '0 8px 32px hsl(var(--foreground) / 0.12), var(--glass-highlight)',
          }}
          data-guest-nav
        >
          {primary.map((it) => renderButton(it.id, it.label, it.icon, active === it.id))}
          {renderButton(
            'settings',
            settingsLabel ?? t('settings.title'),
            Settings,
            active === 'settings',
          )}
        </div>
      </div>
    </nav>
  );
}

export default AppBottomNav;
