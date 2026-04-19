import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Package, TrendingUp, Settings } from 'lucide-react';
import { useHaptics } from '@/platform/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

export type OwnerNavTab = 'overview' | 'inventory' | 'team' | 'finance' | 'settings';

interface Props {
  active: OwnerNavTab;
  onChange: (tab: OwnerNavTab) => void;
  onOpenSettings: () => void;
}

const OwnerBottomNav: React.FC<Props> = ({ active, onChange, onOpenSettings }) => {
  const { t } = useTranslation();
  const haptics = useHaptics();

  const tabs: { id: OwnerNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: t('owner.tabs.home'),      icon: <LayoutDashboard className="w-[22px] h-[22px]" /> },
    { id: 'inventory', label: 'المخزون',                  icon: <Package className="w-[22px] h-[22px]" /> },
    { id: 'team',      label: t('owner.tabs.team'),      icon: <Users className="w-[22px] h-[22px]" /> },
    { id: 'finance',   label: t('owner.tabs.finance'),   icon: <TrendingUp className="w-[22px] h-[22px]" /> },
    { id: 'settings',  label: t('settings.title'),       icon: <Settings className="w-[22px] h-[22px]" /> },
  ];

  const handle = (id: OwnerNavTab) => {
    haptics.impact(ImpactStyle.Light);
    if (id === 'settings') onOpenSettings();
    else onChange(id);
  };

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
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handle(tab.id)}
                className="flex-1 relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-300 active:scale-90"
                aria-label={tab.label}
              >
                <div
                  className={`flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground'
                  }`}
                >
                  {tab.icon}
                </div>
                <span
                  className={`text-[10px] font-bold leading-tight transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute -top-0.5 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default OwnerBottomNav;
