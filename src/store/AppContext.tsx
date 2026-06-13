/**
 * AppContext - Backward-compatible wrapper
 * Combines AuthContext, DataContext, and NotificationContext
 * All existing useApp() calls continue to work
 */
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';
import { NotificationProvider, useNotifications } from './NotificationContext';
import { CurrencyProvider } from './CurrencyContext';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <DataProvider>
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </DataProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

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

    refreshProducts: data.refreshProducts,
    refreshCustomers: data.refreshCustomers,
    refreshSales: data.refreshSales,
    refreshPayments: data.refreshPayments,
    refreshPurchases: data.refreshPurchases,
    refreshDeliveries: data.refreshDeliveries,
    refreshPendingEmployees: data.refreshPendingEmployees,
    refreshDistributorInventory: data.refreshDistributorInventory,
    refreshLicenses: data.refreshLicenses,

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

    notifications: notifications.notifications,
    addNotification: notifications.addNotification,
  };
};

export { useAuth } from './AuthContext';
export { useData } from './DataContext';
export { useNotifications } from './NotificationContext';
