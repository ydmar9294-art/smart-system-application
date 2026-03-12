/**
 * Inventory Mutations Hook — Purchases, deliveries, returns, employees
 * With optimistic UI updates for addPurchase
 */
import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { inventoryService } from '@/services/inventoryService';
import { licenseService } from '@/services/licenseService';
import { UserRole, EmployeeType, LicenseStatus, Product } from '@/types';
import { PendingEmployee, Purchase } from '@/hooks/useDataOperations';
import { extractErrorMessage } from '@/lib/errorHandler';
import { generateUUID } from '@/lib/uuid';

export function useInventoryMutations(
  orgId?: string | null,
  onSuccess?: (msg: string) => void,
  onWarning?: (msg: string) => void,
  onError?: (msg: string) => void
) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    logger.error('Inventory mutation error', 'InventoryMutations');
    onError?.(extractErrorMessage(err));
    throw err;
  }, [onError]);

  const addDistributor = useCallback(async (name: string, phone: string, role: UserRole, type: EmployeeType) => {
    try {
      const code = await inventoryService.addEmployee(name, phone, role, type);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingEmployees(orgId) });
      const employee = await inventoryService.fetchEmployeeByCode(code);
      return { code, employee };
    } catch (e) {
      handleError(e);
      return { code: '', employee: null as PendingEmployee | null };
    }
  }, [queryClient, orgId, handleError]);

  const addPurchase = useCallback(async (productId: string, quantity: number, unitPrice: number, supplierName?: string, notes?: string) => {
    // Optimistic: update product stock immediately
    const prodKey = queryKeys.products(orgId);
    const previousProducts = queryClient.getQueryData<Product[]>(prodKey);

    if (previousProducts) {
      queryClient.setQueryData<Product[]>(prodKey, old =>
        (old || []).map(p =>
          p.id === productId ? { ...p, stock: p.stock + quantity } : p
        )
      );
    }

    try {
      await inventoryService.addPurchase(productId, quantity, unitPrice, supplierName, notes);
    } catch (err) {
      // Rollback
      if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
      handleError(err);
      return;
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
    queryClient.invalidateQueries({ queryKey: prodKey });
  }, [queryClient, orgId, handleError]);

  const createDelivery = useCallback(async (distributorName: string, items: any[], notes?: string, distributorId?: string) => {
    // Optimistic: deduct stock from products
    const prodKey = queryKeys.products(orgId);
    const previousProducts = queryClient.getQueryData<Product[]>(prodKey);

    if (previousProducts) {
      const itemMap = new Map<string, number>();
      items.forEach(it => {
        const pid = it.product_id || it.productId;
        itemMap.set(pid, (itemMap.get(pid) || 0) + it.quantity);
      });
      queryClient.setQueryData<Product[]>(prodKey, old =>
        (old || []).map(p => itemMap.has(p.id) ? { ...p, stock: Math.max(0, p.stock - (itemMap.get(p.id) || 0)) } : p)
      );
    }

    try {
      await inventoryService.createDelivery(distributorName, items, notes, distributorId);
    } catch (err) {
      if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
      // Force refresh authoritative server state after rollback
      queryClient.invalidateQueries({ queryKey: prodKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
      handleError(err);
      return;
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries(orgId) });
    queryClient.invalidateQueries({ queryKey: prodKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.distributorInventory(orgId) });
  }, [queryClient, orgId, handleError]);

  const createPurchaseReturn = useCallback(async (
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[],
    reason?: string, supplierName?: string
  ) => {
    // Optimistic: deduct stock
    const prodKey = queryKeys.products(orgId);
    const previousProducts = queryClient.getQueryData<Product[]>(prodKey);

    if (previousProducts) {
      const itemMap = new Map<string, number>();
      items.forEach(it => itemMap.set(it.product_id, (itemMap.get(it.product_id) || 0) + it.quantity));
      queryClient.setQueryData<Product[]>(prodKey, old =>
        (old || []).map(p => itemMap.has(p.id) ? { ...p, stock: Math.max(0, p.stock - (itemMap.get(p.id) || 0)) } : p)
      );
    }

    try {
      await inventoryService.createPurchaseReturn(items, reason, supplierName);
    } catch (err) {
      if (previousProducts) queryClient.setQueryData(prodKey, previousProducts);
      handleError(err);
      return;
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns(orgId) });
  }, [queryClient, orgId, handleError]);

  const deactivateEmployee = useCallback(async (employeeId: string): Promise<boolean> => {
    try {
      const result = await inventoryService.deactivateEmployee(employeeId);
      if (result?.success) {
        onSuccess?.(result.message || 'تم تعطيل الموظف بنجاح');
        queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
        return true;
      } else {
        onError?.(result?.message || 'فشل في تعطيل الموظف');
        return false;
      }
    } catch (e) { handleError(e); return false; }
  }, [queryClient, orgId, onSuccess, onError, handleError]);

  const reactivateEmployee = useCallback(async (employeeId: string): Promise<boolean> => {
    try {
      const result = await inventoryService.reactivateEmployee(employeeId);
      if (result?.success) {
        onSuccess?.(result.message || 'تم إعادة تنشيط الموظف بنجاح');
        queryClient.invalidateQueries({ queryKey: queryKeys.users(orgId) });
        return true;
      } else {
        onError?.(result?.message || 'فشل في إعادة تنشيط الموظف');
        return false;
      }
    } catch (e) { handleError(e); return false; }
  }, [queryClient, orgId, onSuccess, onError, handleError]);

  // License mutations
  const issueLicense = useCallback(async (orgName: string, type: 'TRIAL', days: number, maxEmployees: number, ownerPhone?: string) => {
    try {
      await licenseService.issueLicense(orgName, type, days, maxEmployees, ownerPhone);
      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
      onSuccess?.('تم إصدار الترخيص بنجاح');
    } catch (e) { handleError(e); }
  }, [queryClient, onSuccess, handleError]);

  const updateLicenseStatus = useCallback(async (id: string, _ownerId: string | null, status: LicenseStatus) => {
    try {
      await licenseService.updateLicenseStatus(id, status);
      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });
    } catch (e) { handleError(e); }
  }, [queryClient, handleError]);

  const makeLicensePermanent = useCallback(async (_id: string, _ownerId: string | null) => {
    logger.warn('makeLicensePermanent is deprecated', 'InventoryMutations');
  }, []);

  const updateLicenseMaxEmployees = useCallback(async (licenseId: string, maxEmployees: number) => {
    try {
      const result = await licenseService.updateLicenseMaxEmployees(licenseId, maxEmployees);
      queryClient.invalidateQueries({ queryKey: queryKeys.licenses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orgStats() });

      if (result?.exceeds_limit) {
        onWarning?.(`تحذير: عدد الموظفين الحاليين (${result.current_employees}) يتجاوز الحد الجديد (${maxEmployees}).`);
      } else {
        onSuccess?.('تم تحديث حد الموظفين بنجاح');
      }
      return { currentEmployees: result?.current_employees || 0, exceedsLimit: result?.exceeds_limit || false };
    } catch (e) { handleError(e); return null; }
  }, [queryClient, onSuccess, onWarning, handleError]);

  return {
    addDistributor, addPurchase, createDelivery, createPurchaseReturn,
    deactivateEmployee, reactivateEmployee,
    issueLicense, updateLicenseStatus, makeLicensePermanent, updateLicenseMaxEmployees,
  };
}
