/**
 * DataContext - Refactored to compose domain-specific hooks
 * 
 * Architecture:
 * - Thin composition layer over domain mutation hooks
 * - Backward compatible interface for all useData() consumers
 * - Staggered refresh to prevent network bursts
 * - Service layer handles all Supabase calls
 */
import React, { createContext, useContext, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserRole, Product, Customer, Sale, Payment, License, EmployeeType, LicenseStatus, OrgStats } from '@/types';
import { Purchase, Delivery, PendingEmployee, DistributorInventoryItem } from '@/hooks/useDataOperations';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { queryKeys } from '@/lib/queryClient';
import {
  useProductsQuery, useCustomersQuery, useSalesQuery, usePaymentsQuery,
  usePurchasesQuery, useDeliveriesQuery, usePendingEmployeesQuery,
  useDistributorInventoryQuery, useUsersQuery, useLicensesQuery, useOrgStatsQuery,
  usePurchaseReturnsQuery, PurchaseReturn
} from '@/hooks/queries';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSalesMutations } from '@/hooks/data/useSalesMutations';
import { useProductMutations } from '@/hooks/data/useProductMutations';
import { useCustomerMutations } from '@/hooks/data/useCustomerMutations';
import { useCollectionMutations } from '@/hooks/data/useCollectionMutations';
import { useInventoryMutations } from '@/hooks/data/useInventoryMutations';
import { staggeredRefresh } from '@/hooks/data/staggeredRefresh';

// ============================================
// Context Type (unchanged interface)
// ============================================

interface DataContextType {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  users: any[];
  licenses: License[];
  purchases: Purchase[];
  deliveries: Delivery[];
  pendingEmployees: PendingEmployee[];
  distributorInventory: DistributorInventoryItem[];
  purchaseReturns: PurchaseReturn[];
  orgStats: OrgStats[];

  refreshProducts: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  refreshSales: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshPurchases: () => Promise<void>;
  refreshDeliveries: () => Promise<void>;
  refreshPendingEmployees: () => Promise<void>;
  refreshDistributorInventory: () => Promise<void>;
  refreshPurchaseReturns: () => Promise<void>;
  refreshLicenses: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  refreshOrgStats: () => Promise<void>;

  createSale: (customerId: string, items: any[]) => Promise<void>;
  submitInvoice: (data: any) => Promise<void>;
  submitPayment: (data: any) => Promise<void>;
  voidSale: (saleId: string, reason: string) => Promise<void>;
  addCollection: (saleId: string, amount: number, notes?: string) => Promise<void>;
  reversePayment: (paymentId: string, reason: string) => Promise<void>;
  addCustomer: (name: string, phone: string, location?: string) => Promise<void>;
  addDistributor: (name: string, phone: string, role: UserRole, type: EmployeeType) => Promise<{ code: string; employee: PendingEmployee | null }>;
  addProduct: (product: Omit<Product, 'id' | 'organization_id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  issueLicense: (orgName: string, type: 'TRIAL', days: number, maxEmployees: number, ownerPhone?: string) => Promise<void>;
  updateLicenseStatus: (id: string, ownerId: string | null, status: LicenseStatus) => Promise<void>;
  /** @deprecated Permanent licenses no longer supported */
  makeLicensePermanent: (id: string, ownerId: string | null) => Promise<void>;
  updateLicenseMaxEmployees: (licenseId: string, maxEmployees: number) => Promise<{ currentEmployees: number; exceedsLimit: boolean } | null>;
  addPurchase: (productId: string, quantity: number, unitPrice: number, supplierName?: string, notes?: string) => Promise<void>;
  createDelivery: (distributorName: string, items: any[], notes?: string, distributorId?: string) => Promise<void>;
  createPurchaseReturn: (items: { product_id: string; product_name: string; quantity: number; unit_price: number }[], reason?: string, supplierName?: string) => Promise<void>;
  deactivateEmployee: (employeeId: string) => Promise<boolean>;
  reactivateEmployee: (employeeId: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | null>(null);

// ============================================
// Provider — composes domain hooks
// ============================================

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, organization, user } = useAuth();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const orgId = organization?.id;
  const employeeType = user?.employeeType as EmployeeType | undefined;

  // Realtime subscriptions
  useRealtimeSync(orgId, role);

  // ============================================
  // Query hooks — automatic caching & deduplication
  // ============================================
  const { data: products = [] } = useProductsQuery(orgId, role);
  const { data: customers = [] } = useCustomersQuery(orgId, role);
  const { data: sales = [] } = useSalesQuery(orgId, role);
  const { data: payments = [] } = usePaymentsQuery(orgId, role);
  const { data: purchases = [] } = usePurchasesQuery(orgId, role);
  const { data: deliveries = [] } = useDeliveriesQuery(orgId, role);
  const { data: pendingEmployees = [] } = usePendingEmployeesQuery(orgId, role, employeeType);
  const { data: distributorInventory = [] } = useDistributorInventoryQuery(orgId, role);
  const { data: purchaseReturns = [] } = usePurchaseReturnsQuery(orgId, role, employeeType);
  const { data: users = [] } = useUsersQuery(orgId, role, employeeType);
  const { data: licenses = [] } = useLicensesQuery(role);
  const { data: orgStats = [] } = useOrgStatsQuery(role);

  // ============================================
  // Notification callbacks for mutation hooks
  // ============================================
  const notifyError = useCallback((msg: string) => addNotification(msg, 'error'), [addNotification]);
  const notifySuccess = useCallback((msg: string) => addNotification(msg, 'success'), [addNotification]);
  const notifyWarning = useCallback((msg: string) => addNotification(msg, 'warning'), [addNotification]);

  // ============================================
  // Domain mutation hooks
  // ============================================
  const salesMutations = useSalesMutations(orgId, notifyError);
  const productMutations = useProductMutations(orgId, notifySuccess, notifyError);
  const customerMutations = useCustomerMutations(orgId, notifySuccess, notifyError);
  const collectionMutations = useCollectionMutations(orgId, notifyError);
  const inventoryMutations = useInventoryMutations(orgId, notifySuccess, notifyWarning, notifyError);

  // ============================================
  // Targeted invalidation helpers
  // ============================================
  const refreshProducts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
  }, [queryClient, orgId]);

  const refreshCustomers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
  }, [queryClient, orgId]);

  const refreshSales = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
  }, [queryClient, orgId]);

  const refreshPayments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
  }, [queryClient, orgId]);

  const refreshPurchases = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
  }, [queryClient, orgId]);

  const refreshDeliveries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.deliveries(orgId) });
  }, [queryClient, orgId]);

  const refreshPendingEmployees = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) });
  }, [queryClient, orgId]);

  const refreshDistributorInventory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
  }, [queryClient, orgId]);

  const refreshPurchaseReturns = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns(orgId) });
  }, [queryClient, orgId]);

  const refreshLicenses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
  }, [queryClient]);

  const refreshOrgStats = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
  }, [queryClient]);

  // Staggered refresh — prevents request spikes
  const refreshAllData = useCallback(async () => {
    await staggeredRefresh(queryClient, orgId);
  }, [queryClient, orgId]);

  // ============================================
  // Compose context value from domain hooks
  // ============================================
  const value: DataContextType = {
    products, customers, sales, payments, users, licenses,
    purchases, deliveries, pendingEmployees, distributorInventory,
    purchaseReturns, orgStats,

    refreshProducts, refreshCustomers, refreshSales, refreshPayments,
    refreshPurchases, refreshDeliveries, refreshPendingEmployees,
    refreshDistributorInventory, refreshPurchaseReturns, refreshLicenses,
    refreshAllData, refreshOrgStats,

    // Sales mutations
    createSale: salesMutations.createSale,
    submitInvoice: salesMutations.submitInvoice,
    submitPayment: salesMutations.submitPayment,
    voidSale: salesMutations.voidSale,

    // Collection mutations
    addCollection: collectionMutations.addCollection,
    reversePayment: collectionMutations.reversePayment,

    // Customer mutations
    addCustomer: customerMutations.addCustomer,

    // Product mutations
    addProduct: productMutations.addProduct,
    updateProduct: productMutations.updateProduct,
    deleteProduct: productMutations.deleteProduct,

    // Inventory & license mutations
    addDistributor: inventoryMutations.addDistributor,
    addPurchase: inventoryMutations.addPurchase,
    createDelivery: inventoryMutations.createDelivery,
    createPurchaseReturn: inventoryMutations.createPurchaseReturn,
    deactivateEmployee: inventoryMutations.deactivateEmployee,
    reactivateEmployee: inventoryMutations.reactivateEmployee,
    issueLicense: inventoryMutations.issueLicense,
    updateLicenseStatus: inventoryMutations.updateLicenseStatus,
    makeLicensePermanent: inventoryMutations.makeLicensePermanent,
    updateLicenseMaxEmployees: inventoryMutations.updateLicenseMaxEmployees,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
