import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Sun, Moon, LogOut, Shield, FileText, Trash2, 
  ChevronLeft, ChevronRight, Loader2, Globe, Palette
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
      className="pb-8 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* ── Appearance ── */}
      <SettingsSection title={t('settings.appearance')} icon={<Palette className="w-3.5 h-3.5" />} delay={0}>
        <button onClick={toggleTheme} className="settings-row group">
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              {isDark ? <Moon className="w-4 h-4 text-primary" strokeWidth={1.5} /> : <Sun className="w-4 h-4 text-primary" strokeWidth={1.5} />}
            </div>
            <div className="text-start">
              <p className="text-[13px] font-bold text-foreground">
                {isDark ? t('theme.dark') : t('theme.light')}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{t('settings.themeDesc')}</p>
            </div>
          </div>
          <div className={`settings-toggle ${isDark ? 'settings-toggle-on' : 'settings-toggle-off'}`}>
            <div className="settings-toggle-thumb" />
          </div>
        </button>
      </SettingsSection>

      {/* ── Language ── */}
      <SettingsSection title={t('settings.language')} icon={<Globe className="w-3.5 h-3.5" />} delay={1}>
        <div className="px-4 py-3">
          <LanguageSelector />
        </div>
      </SettingsSection>

      {/* ── Account ── */}
      <SettingsSection title={t('settings.account')} delay={2}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="settings-row"
        >
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-destructive/10">
              {loggingOut 
                ? <Loader2 className="w-4 h-4 text-destructive animate-spin" strokeWidth={1.5} />
                : <LogOut className="w-4 h-4 text-destructive" strokeWidth={1.5} />
              }
            </div>
            <p className="text-[13px] font-bold text-destructive">
              {loggingOut ? t('settings.loggingOut') : t('common.logout')}
            </p>
          </div>
        </button>
      </SettingsSection>

      {/* ── Legal ── */}
      <SettingsSection title={t('settings.legal')} delay={3}>
        <button onClick={() => navigate('/privacy-policy')} className="settings-row">
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              <Shield className="w-4 h-4 text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-bold text-foreground">{t('common.privacyPolicy')}</p>
          </div>
          <Chevron className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
        <div className="settings-divider" />
        <button onClick={() => navigate('/terms')} className="settings-row">
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-primary/10">
              <FileText className="w-4 h-4 text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-bold text-foreground">{t('common.termsOfService')}</p>
          </div>
          <Chevron className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </SettingsSection>

      {/* ── Data & Privacy ── */}
      <SettingsSection title={t('settings.dataPrivacy')} delay={4}>
        <div className="settings-row">
          <div className="flex items-center gap-3">
            <div className="settings-icon-box bg-destructive/10">
              <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <AccountDeletionButton />
            </div>
          </div>
        </div>
      </SettingsSection>
    </motion.div>
  );
};

const SettingsSection: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  icon?: React.ReactNode;
  delay?: number;
}> = ({ title, children, icon, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: delay * 0.06, ease: [0.4, 0, 0.2, 1] }}
  >
    <div className="flex items-center gap-1.5 px-1 mb-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{title}</p>
    </div>
    <div className="native-glass-card !rounded-2xl overflow-hidden !p-0">
      {children}
    </div>
  </motion.div>
);

export default SettingsPage;
