/**
 * GuestDashboardShell — wraps the selected role's dashboard in read-only mode
 * with a floating exit button and the timed promo overlay.
 */
import React, { lazy, Suspense } from 'react';
import { LogOut, Eye } from 'lucide-react';
import { useGuest } from '@/store/GuestContext';
import { UserRole, EmployeeType } from '@/types';
import GuestPromoOverlay from './GuestPromoOverlay';

const OwnerDashboard = lazy(() => import('@/features/owner/components/OwnerDashboard'));
const AccountantDashboard = lazy(() => import('@/features/accountant/components/AccountantDashboard'));
const SalesManagerDashboard = lazy(() => import('@/features/salesmanager/components/SalesManagerDashboard'));
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
  const { guestRole, exitGuestMode } = useGuest();

  if (!guestRole) return null;

  const Dashboard = (() => {
    if (guestRole.role === UserRole.OWNER) return OwnerDashboard;
    switch (guestRole.employeeType) {
      case EmployeeType.ACCOUNTANT: return AccountantDashboard;
      case EmployeeType.SALES_MANAGER: return SalesManagerDashboard;
      case EmployeeType.WAREHOUSE_KEEPER: return WarehouseKeeperDashboard;
      case EmployeeType.FIELD_AGENT:
      default: return DistributorDashboard;
    }
  })();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      {/* Guest banner */}
      <div className="fixed top-0 inset-x-0 z-[9990] flex items-center justify-center gap-2 py-2 bg-warning/90 text-warning-foreground text-xs font-black backdrop-blur-sm safe-area-top">
        <Eye className="w-3.5 h-3.5" />
        <span>وضع المعاينة — {guestRole.label}</span>
      </div>

      {/* Read-only wrapper — blocks all pointer events on children */}
      <div className="pt-10" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <Suspense fallback={<Fallback />}>
          <Dashboard />
        </Suspense>
      </div>

      {/* Exit FAB — must be above the pointer-events:none layer */}
      <button
        onClick={exitGuestMode}
        style={{ pointerEvents: 'auto' }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9995] flex items-center gap-2 px-6 py-3 bg-destructive text-destructive-foreground rounded-full font-black text-sm shadow-2xl transition-transform active:scale-95 hover:brightness-110 safe-area-bottom"
      >
        <LogOut className="w-4 h-4" />
        خروج من المعاينة
      </button>

      {/* Timed promo overlay */}
      <GuestPromoOverlay />
    </div>
  );
};

export default GuestDashboardShell;
