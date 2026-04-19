import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from '@/components/ui/drawer';
import { ChevronLeft, ChevronRight, MessageCircle, LogOut, LucideIcon, Sun, Moon, Shield, FileText } from 'lucide-react';
import { usePageTheme } from '@/hooks/usePageTheme';
import AccountDeletionButton from '@/components/AccountDeletionButton';

export interface SettingsItem<T extends string = string> {
  id: T;
  label: string;
  Icon: LucideIcon;
  /** Tailwind text color class for the icon (e.g. 'text-primary') */
  color: string;
  /** Tailwind background color class for the icon (e.g. 'bg-primary/10') */
  bg: string;
}

interface Props<T extends string> {
  open: boolean;
  onClose: () => void;
  items: SettingsItem<T>[];
  onOpenItem: (id: T) => void;
  onLogout: () => void;
  loggingOut?: boolean;
  /** WhatsApp / support URL (default: 963947744162) */
  supportUrl?: string;
}

/**
 * Generic native-style settings drawer (bottom sheet) with grouped rows,
 * support link, and logout — same visual language as Owner.
 */
function AppSettingsSheet<T extends string>({
  open,
  onClose,
  items,
  onOpenItem,
  onLogout,
  loggingOut = false,
  supportUrl = 'https://wa.me/963947744162',
}: Props<T>) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  const { isDark, toggleTheme } = usePageTheme();
  const navigate = useNavigate();

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
      <span
        className={`flex-1 text-start font-bold text-sm ${
          danger ? 'text-destructive' : 'text-foreground'
        }`}
      >
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

            {items.length > 0 && (
              <div className="bg-card/60 rounded-3xl p-1.5 space-y-0.5 border border-border/40">
                {items.map((it, idx) => (
                  <React.Fragment key={it.id}>
                    <Row
                      onClick={() => onOpenItem(it.id)}
                      icon={<it.Icon className="w-5 h-5" />}
                      iconBg={it.bg}
                      iconColor={it.color}
                      label={it.label}
                    />
                    {idx < items.length - 1 && <div className="mx-14 h-px bg-border/40" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Support */}
            <div className="mt-3 bg-card/60 rounded-3xl p-1.5 border border-border/40">
              <a
                href={supportUrl}
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
}

export default AppSettingsSheet;
