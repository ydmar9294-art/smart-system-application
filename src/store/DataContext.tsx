/**
 * DataContext - React Query powered data layer (Section 3 & 4)
 * 
 * Architecture:
 * - Thin adapter over domain-specific React Query hooks
 * - Backward compatible interface for all useData() consumers
 * - Optimistic updates for key mutations (Section 4)
 * - Input validation before every mutation (Section 9)
 * - Centralized query wrappers for consistency (Section 6)
 */
import React, { createContext, useContext, useCallback } from 'react';
import { generateUUID } from '@/lib/uuid';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, Product, Customer, Sale, Payment, License, EmployeeType, LicenseStatus, OrgStats } from '@/types';
import { Purchase, Delivery, PendingEmployee, DistributorInventoryItem, transformPendingEmployee } from '@/hooks/useDataOperations';
import { extractErrorMessage } from '@/lib/errorHandler';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { queryKeys } from '@/lib/queryClient';
import {
  safeRpc, validatePositiveNumber, validateRequiredString,
  validateUUID, validateNonEmptyArray, QueryError
} from '@/lib/safeQuery';
import {
  useProductsQuery, useCustomersQuery, useSalesQuery, usePaymentsQuery,
  usePurchasesQuery, useDeliveriesQuery, usePendingEmployeesQuery,
  useDistributorInventoryQuery, useUsersQuery, useLicensesQuery, useOrgStatsQuery,
  usePurchaseReturnsQuery, PurchaseReturn
} from '@/hooks/queries';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

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
  issueLicense: (orgName: string, type: 'TRIAL' | 'PERMANENT', days: number, maxEmployees: number, ownerPhone?: string) => Promise<void>;
  updateLicenseStatus: (id: string, ownerId: string | null, status: LicenseStatus) => Promise<void>;
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
// Provider (Section 3 — structured provider)
// ============================================

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, organization, user } = useAuth();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const orgId = organization?.id;
  const employeeType = user?.employeeType as EmployeeType | undefined;

  // ============================================
  // Realtime subscriptions — replaces polling for 25K+ scale
  // ============================================
  useRealtimeSync(orgId);

  // ============================================
  // React Query hooks — automatic caching & deduplication
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
  // Error handler
  // ============================================

  const handleError = useCallback((err: any) => {
    console.error('[Data Error]:', err);
    addNotification(extractErrorMessage(err), 'error');
    throw err; // Re-throw so callers can detect failures
  }, [addNotification]);

  // ============================================
  // Targeted invalidation (replace manual refresh)
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

  const refreshAllData = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  // ============================================
  // Mutations with optimistic updates (Section 4) + validation (Section 9)
  // ============================================

  const createSale = useCallback(async (cid: string, items: any[]) => {
    try {
      // Section 9: validate inputs before RPC
      validateUUID(cid, 'معرف العميل');
      validateNonEmptyArray(items, 'أصناف الفاتورة');

      await safeRpc('create_sale_rpc', { p_customer_id: cid, p_items: items });

      // Invalidate affected domains
      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const submitInvoice = useCallback(async (d: any) => {
    try {
      validateUUID(d.customerId, 'معرف العميل');
      validateNonEmptyArray(d.items, 'أصناف الفاتورة');

      await safeRpc('create_sale_rpc', { p_customer_id: d.customerId, p_items: d.items, p_payment_type: d.paymentType });

      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const submitPayment = useCallback(async (d: any) => {
    try {
      validateUUID(d.saleId, 'معرف الفاتورة');
      validatePositiveNumber(d.amount, 'المبلغ');

      await safeRpc('add_collection_rpc', { p_sale_id: d.saleId, p_amount: d.amount });

      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const voidSale = useCallback(async (sid: string, r: string) => {
    try {
      validateUUID(sid, 'معرف الفاتورة');
      validateRequiredString(r, 'سبب الإلغاء');

      await safeRpc('void_sale_rpc', { p_sale_id: sid, p_reason: r });

      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const addCollection = useCallback(async (sid: string, a: number, n?: string) => {
    try {
      validateUUID(sid, 'معرف الفاتورة');
      validatePositiveNumber(a, 'مبلغ التحصيل');

      // Section 4: Optimistic update — update sale remaining in cache
      const salesKey = queryKeys.sales(orgId);
      const previousSales = queryClient.getQueryData<Sale[]>(salesKey);
      if (previousSales) {
        queryClient.setQueryData<Sale[]>(salesKey, old =>
          (old || []).map(sale =>
            sale.id === sid
              ? { ...sale, paidAmount: sale.paidAmount + a, remaining: sale.remaining - a }
              : sale
          )
        );
      }

      try {
        await safeRpc('add_collection_rpc', { p_sale_id: sid, p_amount: a, p_notes: n });
      } catch (err) {
        // Rollback on failure
        if (previousSales) queryClient.setQueryData(salesKey, previousSales);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: salesKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const reversePayment = useCallback(async (pid: string, r: string) => {
    try {
      validateUUID(pid, 'معرف الدفعة');
      validateRequiredString(r, 'سبب العكس');

      await safeRpc('reverse_payment_rpc', { p_payment_id: pid, p_reason: r });

      queryClient.invalidateQueries({ queryKey: queryKeys.sales(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const addCustomer = useCallback(async (name: string, phone: string, location?: string) => {
    try {
      if (!orgId) throw new QueryError('لا توجد منشأة', 'MISSING_ORG');
      validateRequiredString(name, 'اسم العميل');

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new QueryError('غير مسجل الدخول', 'AUTH_REQUIRED');

      // Section 4: Optimistic update — add placeholder customer
      const custKey = queryKeys.customers(orgId);
      const tempId = generateUUID();
      const optimisticCustomer: Customer = {
        id: tempId, name, phone, balance: 0, location,
        organization_id: orgId, created_by: currentUser.id
      };
      queryClient.setQueryData<Customer[]>(custKey, old => [optimisticCustomer, ...(old || [])]);

      try {
        const { error } = await supabase.from('customers').insert({
          name, phone, location,
          organization_id: orgId,
          created_by: currentUser.id
        });
        if (error) throw error;
      } catch (err) {
        // Rollback optimistic update
        queryClient.setQueryData<Customer[]>(custKey, old => (old || []).filter(c => c.id !== tempId));
        throw err;
      }

      addNotification('تم إضافة الزبون بنجاح', 'success');
      queryClient.invalidateQueries({ queryKey: custKey });
    } catch (e) { handleError(e); }
  }, [orgId, queryClient, addNotification, handleError]);

  const addDistributor = useCallback(async (name: string, phone: string, role: UserRole, type: EmployeeType) => {
    try {
      validateRequiredString(name, 'اسم الموظف');

      const code = await safeRpc<string>('add_employee_rpc', {
        p_name: name, p_phone: phone, p_role: role, p_type: type
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) });

      // Fetch the new employee record
      const { data: latestPending } = await supabase
        .from('pending_employees')
        .select('id,name,phone,role,employee_type,activation_code,is_used,created_at,organization_id,activated_at,activated_by')
        .eq('activation_code', code)
        .maybeSingle();

      const employee = latestPending ? transformPendingEmployee(latestPending) : null;
      return { code, employee };
    } catch (e) {
      handleError(e);
      return { code: '', employee: null };
    }
  }, [queryClient, orgId, handleError]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'organization_id'>) => {
    try {
      if (!orgId) throw new QueryError('لا توجد منشأة', 'MISSING_ORG');
      validateRequiredString(product.name, 'اسم المنتج');
      validatePositiveNumber(product.basePrice, 'سعر البيع');

      // Section 4: Optimistic update
      const prodKey = queryKeys.products(orgId);
      const tempId = generateUUID();
      const optimisticProduct: Product = { id: tempId, organization_id: orgId, ...product };
      queryClient.setQueryData<Product[]>(prodKey, old => [optimisticProduct, ...(old || [])]);

      try {
        const { error } = await supabase.from('products').insert({
          name: product.name, category: product.category,
          cost_price: product.costPrice, base_price: product.basePrice,
          consumer_price: product.consumerPrice ?? 0,
          stock: product.stock, min_stock: product.minStock,
          unit: product.unit, organization_id: orgId
        });
        if (error) throw error;
      } catch (err) {
        queryClient.setQueryData<Product[]>(prodKey, old => (old || []).filter(p => p.id !== tempId));
        throw err;
      }

      addNotification('تم إضافة المنتج بنجاح', 'success');
      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [orgId, queryClient, addNotification, handleError]);

  const updateProduct = useCallback(async (product: Product) => {
    try {
      validateUUID(product.id, 'معرف المنتج');
      validateRequiredString(product.name, 'اسم المنتج');

      // Section 4: Optimistic update
      const prodKey = queryKeys.products(orgId);
      const previousProducts = queryClient.getQueryData<Product[]>(prodKey);
      queryClient.setQueryData<Product[]>(prodKey, old =>
        (old || []).map(p => p.id === product.id ? product : p)
      );

      try {
        const { error } = await supabase.from('products').update({
          name: product.name, category: product.category,
          cost_price: product.costPrice, base_price: product.basePrice,
          consumer_price: product.consumerPrice ?? 0,
          stock: product.stock, min_stock: product.minStock,
          unit: product.unit
        }).eq('id', product.id);
        if (error) throw error;
      } catch (err) {
        if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      validateUUID(id, 'معرف المنتج');

      // Section 4: Optimistic — remove from list immediately
      const prodKey = queryKeys.products(orgId);
      const previousProducts = queryClient.getQueryData<Product[]>(prodKey);
      queryClient.setQueryData<Product[]>(prodKey, old => (old || []).filter(p => p.id !== id));

      try {
        const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
      } catch (err) {
        if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
        throw err;
      }

      queryClient.invalidateQueries({ queryKey: prodKey });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const issueLicense = useCallback(async (orgName: string, type: 'TRIAL' | 'PERMANENT', days: number, maxEmployees: number, ownerPhone?: string) => {
    try {
      validateRequiredString(orgName, 'اسم المنشأة');
      validatePositiveNumber(days, 'عدد الأيام');
      validatePositiveNumber(maxEmployees, 'عدد الموظفين');

      await safeRpc('issue_license_rpc', {
        p_org_name: orgName, p_type: type, p_days: days,
        p_max_employees: maxEmployees, p_owner_phone: ownerPhone || null
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
      addNotification('تم إصدار الترخيص بنجاح', 'success');
    } catch (e) { handleError(e); }
  }, [queryClient, addNotification, handleError]);

  const updateLicenseStatus = useCallback(async (id: string, _ownerId: string | null, status: LicenseStatus) => {
    try {
      validateUUID(id, 'معرف الترخيص');

      await safeRpc('update_license_status_rpc', { p_license_id: id, p_status: status });

      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
    } catch (e) { handleError(e); }
  }, [queryClient, handleError]);

  const makeLicensePermanent = useCallback(async (id: string, _ownerId: string | null) => {
    try {
      validateUUID(id, 'معرف الترخيص');

      await safeRpc('make_license_permanent_rpc', { p_license_id: id });

      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
    } catch (e) { handleError(e); }
  }, [queryClient, handleError]);

  const updateLicenseMaxEmployees = useCallback(async (licenseId: string, maxEmployees: number) => {
    try {
      validateUUID(licenseId, 'معرف الترخيص');
      validatePositiveNumber(maxEmployees, 'عدد الموظفين');

      const result = await safeRpc<any>('update_license_max_employees_rpc', {
        p_license_id: licenseId, p_max_employees: maxEmployees
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });

      if (result?.exceeds_limit) {
        addNotification(`تحذير: عدد الموظفين الحاليين (${result.current_employees}) يتجاوز الحد الجديد (${maxEmployees}). لن يتم حذف الموظفين الحاليين لكن لن يمكن إضافة جدد.`, 'warning');
      } else {
        addNotification('تم تحديث حد الموظفين بنجاح', 'success');
      }
      return { currentEmployees: result?.current_employees || 0, exceedsLimit: result?.exceeds_limit || false };
    } catch (e) {
      handleError(e);
      return null;
    }
  }, [queryClient, addNotification, handleError]);

  const addPurchase = useCallback(async (productId: string, quantity: number, unitPrice: number, supplierName?: string, notes?: string) => {
    try {
      validateUUID(productId, 'معرف المنتج');
      validatePositiveNumber(quantity, 'الكمية');
      validatePositiveNumber(unitPrice, 'سعر الوحدة');

      await safeRpc('add_purchase_rpc', {
        p_product_id: productId, p_quantity: quantity, p_unit_price: unitPrice,
        p_supplier_name: supplierName, p_notes: notes
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const createDelivery = useCallback(async (distributorName: string, items: any[], notes?: string, distributorId?: string) => {
    try {
      validateRequiredString(distributorName, 'اسم الموزع');
      validateNonEmptyArray(items, 'أصناف التسليم');

      await safeRpc('create_delivery_rpc', {
        p_distributor_name: distributorName, p_items: items,
        p_notes: notes, p_distributor_id: distributorId
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const createPurchaseReturn = useCallback(async (
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[],
    reason?: string, supplierName?: string
  ) => {
    try {
      validateNonEmptyArray(items, 'أصناف المرتجع');

      await safeRpc('create_purchase_return_rpc', {
        p_items: items, p_reason: reason, p_supplier_name: supplierName
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  // ============================================
  // Employee Deactivation / Reactivation
  // ============================================

  const deactivateEmployee = useCallback(async (employeeId: string): Promise<boolean> => {
    try {
      validateUUID(employeeId, 'معرف الموظف');
      const result = await safeRpc<any>('deactivate_employee_rpc', { p_employee_id: employeeId });
      if (result?.success) {
        addNotification(result.message || 'تم تعطيل الموظف بنجاح', 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
        return true;
      } else {
        addNotification(result?.message || 'فشل في تعطيل الموظف', 'error');
        return false;
      }
    } catch (e) {
      handleError(e);
      return false;
    }
  }, [queryClient, orgId, addNotification, handleError]);

  const reactivateEmployee = useCallback(async (employeeId: string): Promise<boolean> => {
    try {
      validateUUID(employeeId, 'معرف الموظف');
      const result = await safeRpc<any>('reactivate_employee_rpc', { p_employee_id: employeeId });
      if (result?.success) {
        addNotification(result.message || 'تم إعادة تنشيط الموظف بنجاح', 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
        return true;
      } else {
        addNotification(result?.message || 'فشل في إعادة تنشيط الموظف', 'error');
        return false;
      }
    } catch (e) {
      handleError(e);
      return false;
    }
  }, [queryClient, orgId, addNotification, handleError]);

  // ============================================
  // Section 3: Provider value — all data + mutations exposed
  // ============================================

  const value: DataContextType = {
    products, customers, sales, payments, users, licenses,
    purchases, deliveries, pendingEmployees, distributorInventory,
    purchaseReturns, orgStats,
    refreshProducts, refreshCustomers, refreshSales, refreshPayments,
    refreshPurchases, refreshDeliveries, refreshPendingEmployees,
    refreshDistributorInventory, refreshPurchaseReturns, refreshLicenses, refreshAllData, refreshOrgStats,
    createSale, submitInvoice, submitPayment, voidSale, addCollection,
    reversePayment, addCustomer, addDistributor, addProduct, updateProduct,
    deleteProduct, issueLicense, updateLicenseStatus, makeLicensePermanent,
    updateLicenseMaxEmployees,
    addPurchase, createDelivery, createPurchaseReturn,
    deactivateEmployee, reactivateEmployee
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
