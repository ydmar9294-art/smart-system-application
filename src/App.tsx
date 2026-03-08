import React, { lazy, Suspense, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useApp } from '@/store/AppContext';
import { UserRole, EmployeeType } from '@/types';
import { Layout } from '@/components/Layout';
import { ToastManager } from '@/components/ToastManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AuthFlow from '@/features/auth/components/AuthFlow';
import { usePushNotifications } from '@/platform/hooks/usePushNotifications';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { useDeviceRealtime } from '@/hooks/useDeviceRealtime';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import UpdateModal from '@/components/ui/UpdateModal';
import LogoutScreen from '@/components/ui/LogoutScreen';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useStatusBar } from '@/platform/hooks/useStatusBar';
import SecurityGate from '@/components/SecurityGate';
import AccountStatusGate from '@/components/AccountStatusGate';
import AppLoadingSkeleton from '@/components/ui/DashboardSkeleton';
import ConsentGate from '@/components/ConsentGate';
import { useGuest } from '@/store/GuestContext';
import { GuestPromoOverlay, GuestBanner } from '@/features/guest';

// ==========================================
// LAZY-LOADED DASHBOARD COMPONENTS
// Code splitting for reduced initial bundle size
// ==========================================
const DeveloperHub = lazy(() => import('@/features/developer/components/DeveloperHub'));
const OwnerDashboard = lazy(() => import('@/features/owner/components/OwnerDashboard'));
const AccountantDashboard = lazy(() => import('@/features/accountant/components/AccountantDashboard'));
const SalesManagerDashboard = lazy(() => import('@/features/salesmanager/components/SalesManagerDashboard'));
const WarehouseKeeperDashboard = lazy(() => import('@/features/warehouse/components/WarehouseKeeperDashboard'));
const DistributorDashboard = lazy(() => import('@/features/distributor/components/DistributorDashboard'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const EmailConfirmed = lazy(() => import('@/pages/EmailConfirmed'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const AccountDeletion = lazy(() => import('@/pages/AccountDeletion'));

// ==========================================
// LOADING FALLBACK
// ==========================================
const DashboardFallback: React.FC = () => (
  <div className="p-4 space-y-4 animate-in fade-in duration-200">
    <div className="h-8 w-48 bg-muted rounded animate-pulse" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
    <div className="h-64 bg-muted rounded-lg animate-pulse" />
  </div>
);

// ==========================================
// VIEW MANAGER - handles both real and guest roles
// ==========================================
const ViewManager: React.FC = () => {
  const { role, user } = useApp();
  const { t } = useTranslation();
  const { isGuest, guestRole } = useGuest();

  // Resolve which role/employeeType to render
  const effectiveRole = isGuest ? guestRole?.role : role;
  const effectiveEmployeeType = isGuest ? guestRole?.employeeType : user?.employeeType;
  
  const dashboard = (() => {
    switch (effectiveRole) {
      case UserRole.DEVELOPER:
        return <DeveloperHub />;
      case UserRole.OWNER:
        return <OwnerDashboard />;
      case UserRole.EMPLOYEE:
        switch (effectiveEmployeeType) {
          case EmployeeType.ACCOUNTANT:
            return <AccountantDashboard />;
          case EmployeeType.SALES_MANAGER:
            return <SalesManagerDashboard />;
          case EmployeeType.WAREHOUSE_KEEPER:
            return <WarehouseKeeperDashboard />;
          case EmployeeType.FIELD_AGENT:
          default:
            return <DistributorDashboard />;
        }
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t('errors.cannotDetermineUser')}</p>
          </div>
        );
    }
  })();

  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardFallback />}>
        {isGuest ? (
          <div className="guest-readonly-shell pointer-events-none select-none" aria-disabled="true">
            <style>{`
              .guest-readonly-shell input,
              .guest-readonly-shell textarea,
              .guest-readonly-shell select,
              .guest-readonly-shell button:not([data-guest-allow]),
              .guest-readonly-shell [role="button"]:not([data-guest-allow]),
              .guest-readonly-shell a:not([data-guest-allow]) {
                pointer-events: none !important;
                opacity: 0.6;
              }
              .guest-readonly-shell [data-radix-collection-item] {
                pointer-events: auto !important;
                opacity: 1 !important;
              }
            `}</style>
            {dashboard}
          </div>
        ) : dashboard}
      </Suspense>
    </ErrorBoundary>
  );
};

// ==========================================
// MAIN CONTENT
// ==========================================
const MainContent: React.FC = () => {
  const { user, role, isLoading, refreshAuth, needsActivation, logout } = useApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Initialize theme early so loading/auth screens also get dark mode
  usePageTheme();
  useStatusBar();
  
  usePushNotifications();
  const { isOnline, pendingCount } = useOfflineSync();
  const { showUpdateModal, isForceUpdate, checkResult, dismiss } = useVersionCheck();
  
  // Real-time device session monitoring
  useDeviceRealtime(user?.id);

  // Logout screen lifecycle
  useEffect(() => {
    const onStart = () => setIsLoggingOut(true);
    const onFinish = () => setIsLoggingOut(false);
    window.addEventListener('logout-started', onStart);
    window.addEventListener('logout-finished', onFinish);
    return () => {
      window.removeEventListener('logout-started', onStart);
      window.removeEventListener('logout-finished', onFinish);
    };
  }, []);

  // Listen for device-revoked events (from useSession online handler)
  useEffect(() => {
    const handleDeviceRevoked = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { toast } = await import('sonner');
      toast.error(detail?.message || 'تم تسجيل الدخول من جهاز آخر', { duration: 6000 });
      logout();
    };
    window.addEventListener('device-revoked', handleDeviceRevoked);
    return () => window.removeEventListener('device-revoked', handleDeviceRevoked);
  }, [logout]);

  // Global unhandled rejection safety net
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error('[App] Unhandled rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Logout goodbye screen — blocks everything
  if (isLoggingOut) return <LogoutScreen />;

  // Loading — show skeleton instead of spinner for instant perceived speed
  if (isLoading) return <AppLoadingSkeleton />;

  // Force update blocks everything
  if (isForceUpdate && showUpdateModal) {
    return (
      <UpdateModal
        open={true}
        isForce={true}
        versionInfo={checkResult?.versionInfo}
        currentVersion={checkResult?.currentVersion}
        onDismiss={() => {}}
      />
    );
  }

  if (!user || needsActivation) {
    return (
      <>
        <ToastManager />
        <AuthFlow onAuthComplete={refreshAuth} />
        <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
      </>
    );
  }

  // Developers skip consent gate
  const content = (
    <AccountStatusGate>
      <Layout><ViewManager /></Layout>
    </AccountStatusGate>
  );

  return (
    <>
      <ToastManager />
      {role === UserRole.DEVELOPER ? content : (
        <ConsentGate userId={user.id}>
          {content}
        </ConsentGate>
      )}
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
      <UpdateModal
        open={showUpdateModal}
        isForce={false}
        versionInfo={checkResult?.versionInfo}
        currentVersion={checkResult?.currentVersion}
        onDismiss={dismiss}
      />
    </>
  );
};

// ==========================================
// APP - Main Application Entry Point
// ==========================================
const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let exitPressedOnce = false;
    let exitTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleBackButton = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const isOnHomeScreen = location.pathname === '/' || location.pathname === '';
      
      if (!isOnHomeScreen && canGoBack) {
        navigate(-1);
      } else {
        // Double-press to exit
        if (exitPressedOnce) {
          CapacitorApp.exitApp();
        } else {
          exitPressedOnce = true;
          if (exitTimeout) clearTimeout(exitTimeout);
          exitTimeout = setTimeout(() => { exitPressedOnce = false; }, 2000);
        }
      }
    });

    return () => {
      handleBackButton.then(listener => listener.remove());
      if (exitTimeout) clearTimeout(exitTimeout);
    };
  }, [navigate, location.pathname]);

  return (
    <SecurityGate blockRooted={false} blockSideloaded={false}>
      <Routes>
        <Route path="/reset-password" element={
          <Suspense fallback={<DashboardFallback />}>
            <ResetPassword />
          </Suspense>
        } />
        <Route path="/email-confirmed" element={
          <Suspense fallback={<DashboardFallback />}>
            <EmailConfirmed />
          </Suspense>
        } />
        <Route path="/privacy-policy" element={
          <Suspense fallback={<DashboardFallback />}>
            <PrivacyPolicy />
          </Suspense>
        } />
        <Route path="/terms" element={
          <Suspense fallback={<DashboardFallback />}>
            <TermsOfService />
          </Suspense>
        } />
        <Route path="/account-deletion" element={
          <Suspense fallback={<DashboardFallback />}>
            <AccountDeletion />
          </Suspense>
        } />
        <Route path="*" element={<MainContent />} />
      </Routes>
    </SecurityGate>
  );
};

export default App;
