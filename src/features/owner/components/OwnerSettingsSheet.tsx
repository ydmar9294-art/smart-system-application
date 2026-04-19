import React from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from '@/components/ui/drawer';
import {
  CreditCard, Database, Coins, MapPin, ShieldCheck, MessageCircle, LogOut,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

export type SettingsSubPage = 'subscription' | 'backup' | 'currencies' | 'tracking' | 'legal' | null;

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSubPage: (page: Exclude<SettingsSubPage, null>) => void;
  onLogout: () => void;
  loggingOut: boolean;
}

const OwnerSettingsSheet: React.FC<Props> = ({ open, onClose, onOpenSubPage, onLogout, loggingOut }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const items: {
    id: Exclude<SettingsSubPage, null>;
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
  }[] = [
    { id: 'subscription', label: t('owner.tabs.subscription'), icon: <CreditCard className="w-5 h-5" />, color: 'text-primary',           bg: 'bg-primary/10' },
    { id: 'backup',       label: t('owner.tabs.backup'),       icon: <Database className="w-5 h-5" />,   color: 'text-blue-600',          bg: 'bg-blue-500/10' },
    { id: 'currencies',   label: 'العملات والصرف',              icon: <Coins className="w-5 h-5" />,      color: 'text-amber-600',         bg: 'bg-amber-500/10' },
    { id: 'tracking',     label: t('tracking.tab'),             icon: <MapPin className="w-5 h-5" />,     color: 'text-purple-600',        bg: 'bg-purple-500/10' },
    { id: 'legal',        label: t('owner.tabs.legal'),         icon: <ShieldCheck className="w-5 h-5" />,color: 'text-emerald-600',       bg: 'bg-emerald-500/10' },
  ];

  const Row: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    label: string;
    danger?: boolean;
    disabled?: boolean;
  }> = ({ onClick, icon, iconBg, iconColor, label, danger, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] ${
        danger ? 'hover:bg-destructive/5' : 'hover:bg-muted/60'
      } disabled:opacity-50`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <span className={`flex-1 text-start font-bold text-sm ${danger ? 'text-destructive' : 'text-foreground'}`}>
        {label}
      </span>
      {!danger && <Chevron className="w-4 h-4 text-muted-foreground/60" />}
    </button>
  );

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent
          className="!rounded-t-[28px] bg-background border-t border-border"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div
            className="px-3 pb-4 max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            <h2 className="text-lg font-black text-foreground text-center mb-3">
              {t('settings.title')}
            </h2>

            {/* Settings rows */}
            <div className="bg-card/60 rounded-3xl p-1.5 space-y-0.5 border border-border/40">
              {items.map((it, idx) => (
                <React.Fragment key={it.id}>
                  <Row
                    onClick={() => onOpenSubPage(it.id)}
                    icon={it.icon}
                    iconBg={it.bg}
                    iconColor={it.color}
                    label={it.label}
                  />
                  {idx < items.length - 1 && (
                    <div className="mx-14 h-px bg-border/40" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Support */}
            <div className="mt-3 bg-card/60 rounded-3xl p-1.5 border border-border/40">
              <a
                href="https://wa.me/963947744162"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/60 transition-all active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/10 text-green-600">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="flex-1 text-start font-bold text-sm text-foreground">
                  {t('common.supportTeam')}
                </span>
                <Chevron className="w-4 h-4 text-muted-foreground/60" />
              </a>
            </div>

            {/* Logout */}
            <div className="mt-3 bg-card/60 rounded-3xl p-1.5 border border-border/40">
              <Row
                onClick={onLogout}
                disabled={loggingOut}
                icon={<LogOut className="w-5 h-5" />}
                iconBg="bg-destructive/10"
                iconColor="text-destructive"
                label={t('common.logout')}
                danger
              />
            </div>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
};

export default OwnerSettingsSheet;
