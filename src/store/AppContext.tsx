/**
 * AppContext - Backward-compatible wrapper
 * Combines AuthContext, DataContext, and NotificationContext
 * All existing useApp() calls continue to work
 */
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';
import { NotificationProvider, useNotifications } from './NotificationContext';

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
// Backward-compatible hook
// Merges all contexts so existing useApp() calls work
// ============================================

export const useApp = () => {
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
    authError: auth.authError,
    authPhase: auth.authPhase,
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
