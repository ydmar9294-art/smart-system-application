/**
 * AppContext - Backward-compatible wrapper
 * Combines AuthContext, DataContext, and NotificationContext
 * All existing useApp() calls continue to work
 * 
 * In guest preview mode, returns demo data instead of real contexts.
 */
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';
import { NotificationProvider, useNotifications } from './NotificationContext';
import { useGuestOverride } from './GuestProviders';

// ============================================
// Combined Provider
// ============================================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <DataProvider>
          {children}
        </DataProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

// ============================================
// No-op async functions for guest mode (read-only)
// ============================================
const noop = async () => {};
const noopReturn = async () => ({ code: '', employee: null });
const noopBool = async () => false;
const noopNull = async () => null;

// ============================================
// Backward-compatible hook
// Merges all contexts so existing useApp() calls work
// In guest mode, returns demo data
// ============================================

export const useApp = () => {
  const guestOverride = useGuestOverride();
  
  // Guest mode — return demo data with no-op mutations
  if (guestOverride) {
    return {
      // Auth
      user: guestOverride.user,
      role: guestOverride.role,
      organization: guestOverride.organization,
      isLoading: false,
      isAuthenticated: false,
      needsActivation: false,
      logout: noop,
      refreshAuth: noop,

      // Data
      products: guestOverride.products,
      customers: guestOverride.customers,
      sales: guestOverride.sales,
      payments: guestOverride.payments,
      users: guestOverride.users,
      licenses: guestOverride.licenses,
      purchases: guestOverride.purchases,
      deliveries: guestOverride.deliveries,
      pendingEmployees: guestOverride.pendingEmployees,
      distributorInventory: guestOverride.distributorInventory,
      purchaseReturns: guestOverride.purchaseReturns,
      orgStats: guestOverride.orgStats,
      refreshAllData: noop,

      // Targeted refreshes (no-op)
      refreshProducts: noop,
      refreshCustomers: noop,
      refreshSales: noop,
      refreshPayments: noop,
      refreshPurchases: noop,
      refreshDeliveries: noop,
      refreshPendingEmployees: noop,
      refreshDistributorInventory: noop,
      refreshLicenses: noop,

      // Data mutations (all no-op in guest mode)
      createSale: noop,
      submitInvoice: noop,
      submitPayment: noop,
      voidSale: noop,
      addCollection: noop,
      reversePayment: noop,
      addCustomer: noop,
      addDistributor: noopReturn as any,
      addProduct: noop,
      updateProduct: noop,
      deleteProduct: noop,
      issueLicense: noop,
      updateLicenseStatus: noop,
      makeLicensePermanent: noop,
      updateLicenseMaxEmployees: noopNull as any,
      refreshOrgStats: noop,
      addPurchase: noop,
      createDelivery: noop,
      createPurchaseReturn: noop,
      deactivateEmployee: noopBool as any,
      reactivateEmployee: noopBool as any,

      // Notifications
      notifications: guestOverride.notifications,
      addNotification: () => {},
    };
  }
  
  // Normal authenticated mode
  const auth = useAuth();
  const data = useData();
  const notifications = useNotifications();

  return {
    // Auth
    user: auth.user,
    role: auth.role,
    organization: auth.organization,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    needsActivation: auth.needsActivation,
    logout: auth.logout,
    refreshAuth: auth.refreshAuth,

    // Data
    products: data.products,
    customers: data.customers,
    sales: data.sales,
    payments: data.payments,
    users: data.users,
    licenses: data.licenses,
    purchases: data.purchases,
    deliveries: data.deliveries,
    pendingEmployees: data.pendingEmployees,
    distributorInventory: data.distributorInventory,
    purchaseReturns: data.purchaseReturns,
    refreshAllData: data.refreshAllData,

    // Targeted refreshes (new)
    refreshProducts: data.refreshProducts,
    refreshCustomers: data.refreshCustomers,
    refreshSales: data.refreshSales,
    refreshPayments: data.refreshPayments,
    refreshPurchases: data.refreshPurchases,
    refreshDeliveries: data.refreshDeliveries,
    refreshPendingEmployees: data.refreshPendingEmployees,
    refreshDistributorInventory: data.refreshDistributorInventory,
    refreshLicenses: data.refreshLicenses,

    // Data mutations
    createSale: data.createSale,
    submitInvoice: data.submitInvoice,
    submitPayment: data.submitPayment,
    voidSale: data.voidSale,
    addCollection: data.addCollection,
    reversePayment: data.reversePayment,
    addCustomer: data.addCustomer,
    addDistributor: data.addDistributor,
    addProduct: data.addProduct,
    updateProduct: data.updateProduct,
    deleteProduct: data.deleteProduct,
    issueLicense: data.issueLicense,
    updateLicenseStatus: data.updateLicenseStatus,
    makeLicensePermanent: data.makeLicensePermanent,
    updateLicenseMaxEmployees: data.updateLicenseMaxEmployees,
    orgStats: data.orgStats,
    refreshOrgStats: data.refreshOrgStats,
    addPurchase: data.addPurchase,
    createDelivery: data.createDelivery,
    createPurchaseReturn: data.createPurchaseReturn,
    deactivateEmployee: data.deactivateEmployee,
    reactivateEmployee: data.reactivateEmployee,

    // Notifications
    notifications: notifications.notifications,
    addNotification: notifications.addNotification,
  };
};

// Re-export individual hooks for optimized usage
export { useAuth } from './AuthContext';
export { useData } from './DataContext';
export { useNotifications } from './NotificationContext';
