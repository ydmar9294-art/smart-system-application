import React, { lazy, Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '@/store/AuthContext';
import { UserRole, EmployeeType } from '@/types';
import { Layout } from '@/components/Layout';
import { ToastManager } from '@/components/ToastManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AuthFlow from '@/features/auth/components/AuthFlow';
import { usePushNotifications } from '@/platform/hooks/usePushNotifications';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { useDeviceRealtime } from '@/hooks/useDeviceRealtime';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import UpdateModal from '@/components/ui/UpdateModal';
import LogoutScreen from '@/components/ui/LogoutScreen';
import DeviceRevokedScreen from '@/components/ui/DeviceRevokedScreen';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useStatusBar } from '@/platform/hooks/useStatusBar';
import SecurityGate from '@/components/SecurityGate';
import AccountStatusGate from '@/components/AccountStatusGate';
import AppLoadingSkeleton from '@/components/ui/DashboardSkeleton';
import ConsentGate from '@/components/ConsentGate';
import { useGuest } from '@/store/GuestContext';
import GuestDashboardShell from '@/features/auth/components/GuestDashboardShell';
import PostUpdateMessage from '@/components/ui/PostUpdateMessage';

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
// VIEW MANAGER
// ==========================================
const ViewManager: React.FC = () => {
  const { role, user } = useAuth();
  
  const dashboard = (() => {
    switch (role) {
      case UserRole.DEVELOPER:
        return <DeveloperHub />;
      case UserRole.OWNER:
        return <OwnerDashboard />;
      case UserRole.EMPLOYEE:
        switch (user?.employeeType) {
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
            <p className="text-muted-foreground">لا يمكن تحديد نوع المستخدم</p>
          </div>
        );
    }
  })();

  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardFallback />}>{dashboard}</Suspense>
    </ErrorBoundary>
  );
};

// ==========================================
// MAIN CONTENT
// ==========================================
const MainContent: React.FC = () => {
  const { user, role, isLoading, refreshAuth, needsActivation, logout } = useAuth();
  const { isGuest } = useGuest();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [replacedWarning, setReplacedWarning] = useState<string | null>(null);
  const [deviceRevoked, setDeviceRevoked] = useState(false);
  const [revokedMessage, setRevokedMessage] = useState<string | undefined>();
  
  // Initialize theme early so loading/auth screens also get dark mode
  usePageTheme();
  useStatusBar();
  
  usePushNotifications();
  const { isOnline, pendingCount } = useOfflineSync(role, user?.employeeType);
  const { showUpdateModal, isForceUpdate, checkResult, dismiss } = useVersionCheck();
  
  // Real-time device session monitoring
  // Real-time device session monitoring + 30s heartbeat
  useDeviceRealtime(user?.id);
  useSessionHeartbeat(user?.id);

  // Logout screen lifecycle
  useEffect(() => {
    const onStart = () => {
      setIsLoggingOut(true);
      // Suppress device-revoked during voluntary logout
      (window as any).__voluntaryLogout = true;
    };
    const onFinish = () => {
      setIsLoggingOut(false);
      (window as any).__voluntaryLogout = false;
    };
    window.addEventListener('logout-started', onStart);
    window.addEventListener('logout-finished', onFinish);
    return () => {
      window.removeEventListener('logout-started', onStart);
      window.removeEventListener('logout-finished', onFinish);
    };
  }, []);

  // Device revoked: show 3-second countdown screen then auto-logout
  useEffect(() => {
    const handleDeviceRevoked = (e: Event) => {
      // Ignore if this is a voluntary logout (user pressed logout)
      if ((window as any).__voluntaryLogout || isLoggingOut) return;
      const detail = (e as CustomEvent).detail;
      setRevokedMessage(detail?.message);
      setDeviceRevoked(true);
    };

    window.addEventListener('device-revoked', handleDeviceRevoked);
    return () => window.removeEventListener('device-revoked', handleDeviceRevoked);
  }, [isLoggingOut]);

  const handleRevokedComplete = useCallback(async () => {
    setDeviceRevoked(false);
    await logout();
  }, [logout]);

  // Listen for new-device warning (shown on the NEW device after login replaces old one)
  const warningShownRef = useRef(false);
  useEffect(() => {
    const handleDeviceReplaced = (e: Event) => {
      if (warningShownRef.current) return;
      warningShownRef.current = true;
      const detail = (e as CustomEvent).detail;
      const deviceName = detail?.replacedDeviceName || '';
      // Use a custom toast-like banner
      setReplacedWarning(deviceName);
      setTimeout(() => setReplacedWarning(null), 6000);
    };
    window.addEventListener('device-replaced-warning', handleDeviceReplaced);
    return () => window.removeEventListener('device-replaced-warning', handleDeviceReplaced);
  }, []);

  // Global unhandled rejection safety net
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error('[App] Unhandled rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Device revoked screen — 3 second countdown then logout
  if (deviceRevoked) return <DeviceRevokedScreen message={revokedMessage} onComplete={handleRevokedComplete} />;

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

  // Guest mode — show guest dashboard shell instead of auth
  if (isGuest) {
    return <GuestDashboardShell />;
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
      {/* New-device warning banner (shown on the device that just logged in) */}
      {replacedWarning !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          dir="rtl"
        >
          <div className="max-w-sm w-[90%] animate-in zoom-in-95 fade-in duration-400 pointer-events-auto">
            <div className="bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-xl">📱</span>
              </div>
              <p className="text-sm font-bold leading-relaxed">
                تم تسجيل الخروج من جميع الأجهزة السابقة
                {replacedWarning ? ` (${replacedWarning})` : ''}
              </p>
            </div>
          </div>
        </div>
      )}
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
    <SecurityGate blockRooted={true} blockSideloaded={true}>
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
