import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Sun, Moon, Languages, LogOut, Shield, FileText, Trash2, 
  ChevronLeft, ChevronRight, Palette, Globe, User, Scale,
  ArrowRight, Loader2
} from 'lucide-react';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useApp } from '@/store/AppContext';
import LanguageSelector from '@/components/ui/LanguageSelector';
import AccountDeletionButton from '@/components/AccountDeletionButton';
import { motion } from 'motion/react';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = usePageTheme();
  const { logout } = useApp();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const isRTL = i18n.language === 'ar';

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <motion.div 
      className="pb-8 space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Appearance ── */}
      <SettingsSection title={t('settings.appearance')}>
        <button
          onClick={toggleTheme}
          className="settings-row"
        >
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
            </div>
            <div className="text-start">
              <p className="text-sm font-bold text-foreground">
                {isDark ? t('theme.dark') : t('theme.light')}
              </p>
              <p className="text-[11px] text-muted-foreground">{t('settings.themeDesc')}</p>
            </div>
          </div>
          <div className={`settings-toggle ${isDark ? 'settings-toggle-on' : 'settings-toggle-off'}`}>
            <div className="settings-toggle-thumb" />
          </div>
        </button>
      </SettingsSection>

      {/* ── Language ── */}
      <SettingsSection title={t('settings.language')}>
        <LanguageSelector />
      </SettingsSection>

      {/* ── Account ── */}
      <SettingsSection title={t('settings.account')}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="settings-row text-destructive"
        >
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-destructive/10">
              {loggingOut 
                ? <Loader2 className="w-4 h-4 text-destructive animate-spin" />
                : <LogOut className="w-4 h-4 text-destructive" />
              }
            </div>
            <p className="text-sm font-bold">
              {loggingOut ? t('settings.loggingOut') : t('common.logout')}
            </p>
          </div>
        </button>
      </SettingsSection>

      {/* ── Legal ── */}
      <SettingsSection title={t('settings.legal')}>
        <button
          onClick={() => navigate('/privacy-policy')}
          className="settings-row"
        >
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">{t('common.privacyPolicy')}</p>
          </div>
          <Chevron className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-3" />
        <button
          onClick={() => navigate('/terms')}
          className="settings-row"
        >
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">{t('common.termsOfService')}</p>
          </div>
          <Chevron className="w-4 h-4 text-muted-foreground" />
        </button>
      </SettingsSection>

      {/* ── Data & Privacy ── */}
      <SettingsSection title={t('settings.dataPrivacy')}>
        <div className="px-3 py-2">
          <AccountDeletionButton />
        </div>
      </SettingsSection>
    </motion.div>
  );
};

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">{title}</p>
    <div className="native-glass-card rounded-2xl overflow-hidden divide-y-0">
      {children}
    </div>
  </div>
);

export default SettingsPage;
