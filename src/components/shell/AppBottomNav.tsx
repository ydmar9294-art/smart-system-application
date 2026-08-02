import React from 'react';
import { LucideIcon, LayoutGrid } from 'lucide-react';
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
      data-tour={`tab.${id}`}
      onClick={() => handle(id)}
      className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all duration-100 active:scale-90 ${
        isActive ? 'bg-primary/10' : ''
      }`}
      aria-label={label}
    >
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          isActive ? 'text-primary scale-105' : 'text-muted-foreground'
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
      
    </button>
  );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-lg mx-auto px-3 pb-2 pointer-events-auto">
        <div
          className="app-tabbar rounded-[26px] flex items-center justify-around px-1.5 py-1.5 shadow-card"

        >
          {primary.map((it) => renderButton(it.id, it.label, it.icon, active === it.id))}
          {renderButton(
            'settings',
            settingsLabel ?? 'المزيد',
            LayoutGrid,
            active === 'settings',
          )}
        </div>
      </div>
    </nav>
  );
}

export default AppBottomNav;
