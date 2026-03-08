/**
 * AccountStatusGate - Background checker for account/organization status.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { getCachedAuth, setCachedAuth } from '@/lib/authCache';
import { ShieldAlert, RefreshCw, WifiOff } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AccountStatus {
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'account_status_cache';

const getCachedStatus = (): AccountStatus | null => { try { const raw = localStorage.getItem(CACHE_KEY); if (!raw) return null; return JSON.parse(raw); } catch { return null; } };
const setCachedStatus = (status: AccountStatus): void => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(status)); } catch {} };

const AccountStatusGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { user, role, organization, logout } = useAuth();
  const [status, setStatus] = useState<AccountStatus>(() => getCachedStatus() || { isActive: true, isSuspended: false, suspensionReason: null });
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAccountStatus = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return;
    if (checkingRef.current) return;
    checkingRef.current = true; setChecking(true);

    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_active, organization_id').eq('id', user.id).maybeSingle();
      if (profileError || !profile) { checkingRef.current = false; setChecking(false); return; }

      let licenseActive = true;
      let licenseMessage: string | null = null;

      if (profile.organization_id) {
        const { data: ownerProfile } = await supabase.from('profiles').select('license_key').eq('organization_id', profile.organization_id).eq('role', 'OWNER').maybeSingle();
        if (ownerProfile?.license_key) {
          const { data: licenseData } = await supabase.rpc('get_my_license_info');
          const license = licenseData?.[0];
          if (license) {
            if (license.status === 'SUSPENDED') { licenseActive = false; licenseMessage = t('accountStatus.licenseSuspended'); }
            else if (license.status === 'EXPIRED' || (license.expiry_date && new Date(license.expiry_date) < new Date())) { licenseActive = false; licenseMessage = t('accountStatus.licenseExpired'); }
          }
        }
      }

      const newStatus: AccountStatus = {
        isActive: profile.is_active !== false && licenseActive,
        isSuspended: profile.is_active === false || !licenseActive,
        suspensionReason: profile.is_active === false ? t('accountStatus.profileSuspended') : licenseMessage,
      };

      setStatus(newStatus); setCachedStatus(newStatus);
      if (newStatus.isActive) { const cached = getCachedAuth(); if (cached) setCachedAuth(cached); }
      logger.info(`[AccountStatus] Check: active=${newStatus.isActive}`, 'AccountStatus');
    } catch { logger.warn('[AccountStatus] Check failed', 'AccountStatus'); }
    finally { checkingRef.current = false; setChecking(false); }
  }, [user?.id, t]);

  useEffect(() => {
    if (!user?.id) return;
    if (role === 'DEVELOPER') return;
    const initTimer = setTimeout(checkAccountStatus, 3000);
    intervalRef.current = setInterval(checkAccountStatus, CHECK_INTERVAL_MS);
    const handleOnline = () => setTimeout(checkAccountStatus, 2000);
    const handleVisibility = () => { if (document.visibilityState === 'visible' && navigator.onLine) setTimeout(checkAccountStatus, 1000); };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearTimeout(initTimer); if (intervalRef.current) clearInterval(intervalRef.current); window.removeEventListener('online', handleOnline); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [user?.id, role, checkAccountStatus]);

  if (status.isSuspended && user) {
    const isRtl = document.documentElement.dir === 'rtl';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-card rounded-3xl shadow-2xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto"><ShieldAlert className="w-10 h-10 text-destructive" /></div>
          <div>
            <h2 className="text-xl font-black text-foreground mb-2">{t('accountStatus.suspended')}</h2>
            <p className="text-muted-foreground leading-relaxed">{status.suspensionReason || t('accountStatus.suspendedMessage')}</p>
          </div>
          <div className="space-y-3">
            <button onClick={checkAccountStatus} disabled={checking || !navigator.onLine}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {checking ? (<><RefreshCw className="w-5 h-5 animate-spin" />{t('accountStatus.recheckChecking')}</>) :
               !navigator.onLine ? (<><WifiOff className="w-5 h-5" />{t('accountStatus.noInternet')}</>) :
               (<><RefreshCw className="w-5 h-5" />{t('accountStatus.recheck')}</>)}
            </button>
            <button onClick={logout} className="w-full bg-muted text-muted-foreground py-3 rounded-xl font-bold hover:bg-accent transition-colors">{t('common.logout')}</button>
          </div>
          <p className="text-xs text-muted-foreground">{t('accountStatus.recheckNote')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AccountStatusGate;
