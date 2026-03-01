/**
 * AccountStatusGate
 * Background checker for account/organization status.
 * Shows blocking overlay when account is suspended.
 * Runs checks: on mount, on online event, on app resume, periodically.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'account_status_cache';

const getCachedStatus = (): AccountStatus | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setCachedStatus = (status: AccountStatus): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(status));
  } catch {}
};

const AccountStatusGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, organization, logout } = useAuth();
  const [status, setStatus] = useState<AccountStatus>(() => {
    const cached = getCachedStatus();
    return cached || { isActive: true, isSuspended: false, suspensionReason: null };
  });
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAccountStatus = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);

    try {
      // Check if user profile is active
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_active, organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        checkingRef.current = false;
        setChecking(false);
        return; // Don't block on query errors
      }

      // Check license status
      let licenseActive = true;
      let licenseMessage: string | null = null;

      if (profile.organization_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('license_key')
          .eq('organization_id', profile.organization_id)
          .eq('role', 'OWNER')
          .maybeSingle();

        if (ownerProfile?.license_key) {
          const { data: licenseData } = await supabase
            .rpc('get_my_license_info');

          const license = licenseData?.[0];

          if (license) {
            if (license.status === 'SUSPENDED') {
              licenseActive = false;
              licenseMessage = 'تم تعليق ترخيص المنشأة. تواصل مع المطور.';
            } else if (license.status === 'EXPIRED' || (license.expiry_date && new Date(license.expiry_date) < new Date())) {
              licenseActive = false;
              licenseMessage = 'انتهت صلاحية ترخيص المنشأة. تواصل مع المطور.';
            }
          }
        }
      }

      const newStatus: AccountStatus = {
        isActive: profile.is_active !== false && licenseActive,
        isSuspended: profile.is_active === false || !licenseActive,
        suspensionReason: profile.is_active === false
          ? 'تم تعطيل حسابك. تواصل مع مديرك لإعادة التفعيل.'
          : licenseMessage,
      };

      setStatus(newStatus);
      setCachedStatus(newStatus);

      // If reactivated, update auth cache
      if (newStatus.isActive) {
        const cached = getCachedAuth();
        if (cached) {
          setCachedAuth(cached);
        }
      }

      logger.info(`[AccountStatus] Check: active=${newStatus.isActive}`, 'AccountStatus');
    } catch (err) {
      logger.warn('[AccountStatus] Check failed, keeping last known state', 'AccountStatus');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Developer role doesn't need status checks
    if (role === 'DEVELOPER') return;

    // Initial check after short delay
    const initTimer = setTimeout(checkAccountStatus, 3000);

    // Periodic checks
    intervalRef.current = setInterval(checkAccountStatus, CHECK_INTERVAL_MS);

    // Check on online event
    const handleOnline = () => {
      setTimeout(checkAccountStatus, 2000);
    };

    // Check on app resume (visibility change)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setTimeout(checkAccountStatus, 1000);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, role, checkAccountStatus]);

  // Show blocking overlay if suspended
  if (status.isSuspended && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-card rounded-3xl shadow-2xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          
          <div>
            <h2 className="text-xl font-black text-foreground mb-2">الحساب معلّق</h2>
            <p className="text-muted-foreground leading-relaxed">
              {status.suspensionReason || 'تم تعليق حسابك أو منشأتك. تواصل مع المسؤول لمعرفة التفاصيل.'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={checkAccountStatus}
              disabled={checking || !navigator.onLine}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checking ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> جارٍ التحقق...</>
              ) : !navigator.onLine ? (
                <><WifiOff className="w-5 h-5" /> غير متصل بالإنترنت</>
              ) : (
                <><RefreshCw className="w-5 h-5" /> إعادة التحقق</>
              )}
            </button>
            
            <button
              onClick={logout}
              className="w-full bg-muted text-muted-foreground py-3 rounded-xl font-bold hover:bg-accent transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            إذا تم إعادة تفعيل حسابك، اضغط "إعادة التحقق" للاستمرار.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AccountStatusGate;
