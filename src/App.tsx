import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useApp } from '@/store/AppContext';
import { UserRole, EmployeeType } from '@/types';
import { Layout } from '@/components/Layout';
import { ToastManager } from '@/components/ToastManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import AuthFlow from '@/components/auth/AuthFlow';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import UpdateModal from '@/components/ui/UpdateModal';
import { usePageTheme } from '@/hooks/usePageTheme';
import SecurityGate from '@/components/SecurityGate';

// ==========================================
// LAZY-LOADED DASHBOARD COMPONENTS
// Code splitting for reduced initial bundle size
// ==========================================
const DeveloperHub = lazy(() => import('@/components/developer/DeveloperHub'));
const OwnerDashboard = lazy(() => import('@/components/owner/OwnerDashboard'));
const AccountantDashboard = lazy(() => import('@/components/accountant/AccountantDashboard'));
const SalesManagerDashboard = lazy(() => import('@/components/salesmanager/SalesManagerDashboard'));
const WarehouseKeeperDashboard = lazy(() => import('@/components/warehouse/WarehouseKeeperDashboard'));
const DistributorDashboard = lazy(() => import('@/components/distributor/DistributorDashboard'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
// ==========================================
// LOADING FALLBACK
// ==========================================
const DashboardFallback: React.FC = () => (
  <div className="p-4 space-y-4 animate-in fade-in duration-300">
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
  const { role, user } = useApp();
  
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
  const { user, isLoading, refreshAuth, needsActivation, authError, authPhase } = useApp();
  
  // Initialize theme early so loading/auth screens also get dark mode
  usePageTheme();
  
  usePushNotifications();
  const { isOnline, pendingCount } = useOfflineSync();
  const { showUpdateModal, isForceUpdate, checkResult, dismiss } = useVersionCheck();

  // Progressive loading — phase-aware with guaranteed timeout
  if (isLoading) {
    const phaseText = authPhase === 'verifying' ? 'جارٍ التحقق من الحساب...' : 'جارٍ تحميل النظام...';
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 size={48} className="animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-black text-sm mb-2">{phaseText}</p>
        <p className="text-muted-foreground/40 font-bold text-[10px] uppercase tracking-[0.2em]">Smart System</p>
      </div>
    );
  }

  // Auth error state — show error with retry and logout options
  if (authError && !user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <Loader2 size={32} className="text-destructive" />
      </div>
      <p className="text-foreground font-black text-sm mb-2 text-center">{authError}</p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={refreshAuth}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          إعادة المحاولة
        </button>
        <button
          onClick={async () => {
            const { clearAuthCache } = await import('@/lib/authCache');
            clearAuthCache();
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase.auth.signOut();
            window.location.reload();
          }}
          className="px-6 py-3 bg-muted text-muted-foreground rounded-2xl font-bold text-sm hover:bg-muted/80 transition-colors"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

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

  return (
    <>
      <ToastManager />
      <Layout><ViewManager /></Layout>
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
          // Show a brief toast-like indication (uses native Android toast pattern)
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
        <Route path="/privacy-policy" element={
          <Suspense fallback={<DashboardFallback />}>
            <PrivacyPolicy />
          </Suspense>
        } />
        <Route path="*" element={<MainContent />} />
      </Routes>
    </SecurityGate>
  );
};

export default App;
