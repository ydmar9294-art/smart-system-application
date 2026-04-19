import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { UserRole, LicenseStatus } from '@/types';
import { ShieldAlert, Phone, LogOut, RefreshCw } from 'lucide-react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { usePageTheme } from '@/hooks/usePageTheme';
import { SUPPORT_WHATSAPP_URL, SUPPORT_PHONE_URL } from '@/constants';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, organization, refreshAuth } = useAuth();
  const { refreshAllData } = useData();
  const { t } = useTranslation();
  const isRtl = true; // Arabic-only mode — always RTL
  
  usePageTheme();
  useRealtimeNotifications();

  // Global offline detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handlePullRefresh = useCallback(async () => {
    await refreshAllData();
  }, [refreshAllData]);

  if (!user) {
    return <>{children}</>;
  }

  const licenseStatus = (organization as any)?.licenseStatus;
  const expiryDate = (organization as any)?.expiryDate;

  const isSuspended = licenseStatus === LicenseStatus.SUSPENDED;
  const isExpired = typeof expiryDate === 'number' && expiryDate < Date.now();

  if ((isSuspended || isExpired) && user.role !== UserRole.DEVELOPER) {
    return <LicenseFrozenScreen 
      isExpired={isExpired} 
      isSuspended={isSuspended} 
      onRetry={refreshAuth}
      onLogout={logout}
    />;
  }




  return (
    <>
      {/* Liquid-glass overlay bars — OUTSIDE scroll/transform containers so they stay truly fixed */}
      <div className="glass-bar-top" aria-hidden="true" />
      <div className="glass-bar-bottom" aria-hidden="true" />

      {/* Global Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground py-2 px-4 text-sm font-bold shadow-lg" dir={isRtl ? 'rtl' : 'ltr'}>
          <WifiOff size={16} />
          <span>{t('layout.offlineBanner')}</span>
        </div>
      )}

      <PullToRefresh onRefresh={handlePullRefresh}>
        <div
          className="scroll-under-layout flex bg-background text-end overflow-x-hidden font-tajawal transition-colors duration-300 safe-area-x"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
        <main className="flex-1 relative">
          <div className="p-4 md:p-8">{children}</div>
        </main>
        </div>
      </PullToRefresh>
    </>
  );
};

const LicenseFrozenScreen: React.FC<{
  isExpired: boolean;
  isSuspended: boolean;
  onRetry: () => Promise<void>;
  onLogout: () => Promise<void>;
}> = ({ isExpired, isSuspended, onRetry, onLogout }) => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [reactivated, setReactivated] = useState(false);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    try {
      await onRetry();
      // onRetry (refreshAuth) will update the license state.
      // If the license is now active, Layout will stop rendering this screen.
      // Only show "reactivated" feedback briefly if still mounted.
      setChecking(false);
    } catch {
      setChecking(false);
    }
  }, [onRetry]);

  useEffect(() => {
    const interval = setInterval(handleRetry, 30000);
    return () => clearInterval(interval);
  }, [handleRetry]);

  if (reactivated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center" dir={document.documentElement.dir || 'rtl'}>
        <div className="max-w-md space-y-6 animate-zoom-in">
          <div className="w-24 h-24 rounded-[2.5rem] bg-success flex items-center justify-center text-success-foreground shadow-2xl mx-auto mb-8">
            <RefreshCw size={48} />
          </div>
          <h2 className="text-3xl font-black text-foreground">{t('license.welcomeBack')}</h2>
          <p className="text-muted-foreground font-bold text-lg">{t('license.reactivated')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center" dir={document.documentElement.dir || 'rtl'}>
      <div className="max-w-md space-y-6 animate-zoom-in">
        <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-destructive-foreground shadow-2xl mx-auto mb-8 ${isExpired ? 'bg-warning' : 'bg-destructive'}`}>
          <ShieldAlert size={48} />
        </div>

        <h2 className="text-3xl font-black text-foreground">
          {isExpired ? t('license.expired') : t('license.suspended')}
        </h2>

        <p className="text-muted-foreground font-bold text-lg">
          {isExpired ? t('license.expiredMessage') : t('license.suspendedMessage')}
        </p>

        <p className="text-muted-foreground/70 text-sm">{t('license.autoCheck')}</p>

        <div className="pt-8 flex flex-col gap-3">
          <button onClick={handleRetry} disabled={checking}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw size={20} className={checking ? 'animate-spin' : ''} />
            {checking ? t('license.checking') : t('license.checkLicense')}
          </button>

          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="w-full py-4 bg-success text-success-foreground rounded-2xl font-black shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t('license.contactWhatsapp')}
          </a>

          <a href={SUPPORT_PHONE_URL}
            className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-black transition-transform active:scale-95 flex items-center justify-center gap-2">
            <Phone size={20} />
            {t('license.callFinance')}
          </a>

          <button onClick={onLogout}
            className="w-full py-4 bg-muted text-muted-foreground rounded-2xl font-black flex items-center justify-center gap-2 mt-4">
            <LogOut size={20} />
            {t('common.logout')}
          </button>
        </div>
      </div>
    </div>
  );
};
