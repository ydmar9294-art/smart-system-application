/**
 * Inventory Mutations Hook - Purchases, deliveries, returns, employees
 */
import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { inventoryService } from '@/services/inventoryService';
import { licenseService } from '@/services/licenseService';
import { UserRole, EmployeeType, LicenseStatus } from '@/types';
import { PendingEmployee } from '@/hooks/useDataOperations';
import { extractErrorMessage } from '@/lib/errorHandler';

export function useInventoryMutations(
  orgId?: string | null,
  onSuccess?: (msg: string) => void,
  onWarning?: (msg: string) => void,
  onError?: (msg: string) => void
) {
  const queryClient = useQueryClient();

  const handleError = useCallback((err: any) => {
    console.error('[Inventory Error]:', err);
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
    try {
      await inventoryService.addPurchase(productId, quantity, unitPrice, supplierName, notes);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
    } catch (e) { handleError(e); }
  }, [queryClient, orgId, handleError]);

  const createDelivery = useCallback(async (distributorName: string, items: any[], notes?: string, distributorId?: string) => {
    try {
      await inventoryService.createDelivery(distributorName, items, notes, distributorId);
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
      await inventoryService.createPurchaseReturn(items, reason, supplierName);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns(orgId) });
    } catch (e) { handleError(e); }
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
    console.warn('makeLicensePermanent is deprecated');
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
