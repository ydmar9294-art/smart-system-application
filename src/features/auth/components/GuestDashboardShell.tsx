/**
 * GuestDashboardShell — wraps the selected role's dashboard in read-only mode
 * 
 * Tabs/navigation remain interactive so guests can browse all sections.
 * All actionable elements (buttons, inputs, forms) are disabled via CSS.
 * Provides demo data via GuestDataProviders so dashboards show realistic content.
 */
import React, { lazy, Suspense } from 'react';
import { LogOut, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGuest } from '@/store/GuestContext';
import { UserRole, EmployeeType } from '@/types';
import GuestPromoOverlay from './GuestPromoOverlay';
import { GuestDataProviders } from '@/store/GuestProviders';

const OwnerDashboard = lazy(() => import('@/features/owner/components/OwnerDashboard'));
const AccountantDashboard = lazy(() => import('@/features/accountant/components/AccountantDashboard'));
// SalesManagerDashboard removed — legacy SALES_MANAGER guest preview falls back to AccountantDashboard
const WarehouseKeeperDashboard = lazy(() => import('@/features/warehouse/components/WarehouseKeeperDashboard'));
const DistributorDashboard = lazy(() => import('@/features/distributor/components/DistributorDashboard'));

const Fallback = () => (
  <div className="p-4 space-y-4 animate-pulse">
    <div className="h-8 w-48 bg-muted rounded" />
    <div className="grid grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg" />)}
    </div>
  </div>
);

const GuestDashboardShell: React.FC = () => {
  const { t } = useTranslation();
  const { guestRole, exitGuestMode } = useGuest();
  const isRtl = document.documentElement.dir === 'rtl';

  if (!guestRole) return null;

  const Dashboard = (() => {
    if (guestRole.role === UserRole.OWNER) return OwnerDashboard;
    switch (guestRole.employeeType) {
      case EmployeeType.ACCOUNTANT: return AccountantDashboard;
      case EmployeeType.SALES_MANAGER: return AccountantDashboard; // legacy fallback
      case EmployeeType.WAREHOUSE_KEEPER: return WarehouseKeeperDashboard;
      case EmployeeType.FIELD_AGENT:
      default: return DistributorDashboard;
    }
  })();

  return (
    <GuestDataProviders guestRole={guestRole}>
      <div className="min-h-screen bg-background font-tajawal guest-preview-shell" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Preview banner */}
        <div className="fixed top-0 inset-x-0 z-[9990] flex items-center justify-center gap-2 py-2 bg-warning/90 text-warning-foreground text-xs font-black backdrop-blur-sm safe-area-top">
          <Eye className="w-3.5 h-3.5" />
          <span>{t('guest.previewBanner')} {t(`roles.${guestRole.key}`)}</span>
        </div>

        {/* Dashboard — tabs are clickable, action elements disabled via CSS */}
        <div className="pt-10" style={{ userSelect: 'none' }}>
          <Suspense fallback={<Fallback />}><Dashboard /></Suspense>
        </div>

        {/* Read-only notice */}
        <div className="fixed bottom-[4.5rem] inset-x-0 z-[9989] flex justify-center pointer-events-none">
          <span className="text-[10px] font-bold text-muted-foreground/50">{t('guest.readOnlyNote')}</span>
        </div>

        {/* Exit button */}
        <button onClick={exitGuestMode} data-guest-allow
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9995] flex items-center gap-2 px-6 py-3 bg-destructive text-destructive-foreground rounded-full font-black text-sm shadow-2xl transition-transform active:scale-95 hover:brightness-110 safe-area-bottom">
          <LogOut className="w-4 h-4" />{t('guest.exitPreview')}
        </button>

        <GuestPromoOverlay />
      </div>
    </GuestDataProviders>
  );
};

export default GuestDashboardShell;
