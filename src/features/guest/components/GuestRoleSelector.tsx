/**
 * GuestRoleSelector - Modal for selecting a role to preview
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Crown, Users, Calculator, Warehouse, Truck } from 'lucide-react';
import { GUEST_ROLES, GuestRole } from '@/store/GuestContext';

interface Props {
  open: boolean;
  onSelect: (role: GuestRole) => void;
  onClose: () => void;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-6 h-6" />,
  salesManager: <Users className="w-6 h-6" />,
  accountant: <Calculator className="w-6 h-6" />,
  warehouseKeeper: <Warehouse className="w-6 h-6" />,
  distributor: <Truck className="w-6 h-6" />,
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  salesManager: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  accountant: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
  warehouseKeeper: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  distributor: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
};

const ICON_COLORS: Record<string, string> = {
  owner: 'text-amber-500',
  salesManager: 'text-blue-500',
  accountant: 'text-emerald-500',
  warehouseKeeper: 'text-purple-500',
  distributor: 'text-cyan-500',
};

const GuestRoleSelector: React.FC<Props> = ({ open, onSelect, onClose }) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md mx-auto bg-background/95 backdrop-blur-2xl rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom-12 duration-300 border border-border/50">
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-5 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-foreground">{t('guest.selectRole')}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t('guest.previewDescription')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Role cards */}
        <div className="space-y-3">
          {GUEST_ROLES.map((gRole) => (
            <button
              key={gRole.label}
              onClick={() => onSelect(gRole)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-r ${ROLE_COLORS[gRole.label]} backdrop-blur-xl active:scale-[0.97] transition-all duration-200 hover:shadow-lg`}
            >
              <div className={`w-12 h-12 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center ${ICON_COLORS[gRole.label]}`}>
                {ROLE_ICONS[gRole.label]}
              </div>
              <div className="text-start flex-1">
                <p className="font-bold text-foreground text-sm">{t(`guest.roles.${gRole.label}`)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t(`guest.roleDesc.${gRole.label}`)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuestRoleSelector;
