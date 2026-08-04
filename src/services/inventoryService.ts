/**
 * Inventory Service - Purchases, deliveries, returns
 */
import { supabase } from '@/integrations/supabase/client';
import { safeRpc, validateUUID, validatePositiveNumber, validateRequiredString, validateNonEmptyArray } from '@/lib/safeQuery';
import { transformPendingEmployee } from '@/hooks/useDataOperations';

export const inventoryService = {
  async addPurchase(
    productId: string, quantity: number, unitPrice: number,
    supplierName?: string, notes?: string,
    packQuantity = 0, pieceQuantity = 0
  ): Promise<string> {
    validateUUID(productId, 'معرف المنتج');
    if (packQuantity <= 0 && pieceQuantity <= 0) validatePositiveNumber(quantity, 'الكمية');
    validatePositiveNumber(unitPrice, 'سعر الوحدة');

    return safeRpc<string>('add_purchase_rpc', {
      p_product_id: productId, p_quantity: quantity, p_unit_price: unitPrice,
      p_supplier_name: supplierName, p_notes: notes,
      p_pack_quantity: packQuantity, p_piece_quantity: pieceQuantity,
    }, { label: 'addPurchase' });
  },

  async createDelivery(distributorName: string, items: any[], notes?: string, distributorId?: string): Promise<string> {
    validateRequiredString(distributorName, 'اسم الموزع');
    validateNonEmptyArray(items, 'أصناف التسليم');

    return safeRpc<string>('create_delivery_rpc', {
      p_distributor_name: distributorName, p_items: items,
      p_notes: notes, p_distributor_id: distributorId,
    }, { label: 'createDelivery' });
  },

  async confirmDelivery(deliveryId: string): Promise<void> {
    validateUUID(deliveryId, 'معرف التسليم');
    return safeRpc<void>('confirm_delivery_rpc', { p_delivery_id: deliveryId }, { label: 'confirmDelivery' });
  },

  async rejectDelivery(deliveryId: string, reason?: string): Promise<void> {
    validateUUID(deliveryId, 'معرف التسليم');
    return safeRpc<void>('reject_delivery_rpc', { p_delivery_id: deliveryId, p_reason: reason }, { label: 'rejectDelivery' });
  },

  async adjustStock(productId: string, delta: number, reason: string): Promise<void> {
    validateUUID(productId, 'معرف المنتج');
    validateRequiredString(reason, 'سبب التسوية');
    return safeRpc<void>('adjust_stock_rpc', {
      p_product_id: productId, p_delta: delta, p_reason: reason,
    }, { label: 'adjustStock' });
  },

  async archiveProduct(productId: string): Promise<void> {
    validateUUID(productId, 'معرف المنتج');
    return safeRpc<void>('archive_product_rpc', { p_product_id: productId }, { label: 'archiveProduct' });
  },

  async restoreProduct(productId: string): Promise<void> {
    validateUUID(productId, 'معرف المنتج');
    return safeRpc<void>('restore_product_rpc', { p_product_id: productId }, { label: 'restoreProduct' });
  },

  async createPurchaseReturn(
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[],
    reason?: string, supplierName?: string
  ): Promise<string> {
    validateNonEmptyArray(items, 'أصناف المرتجع');

    return safeRpc<string>('create_purchase_return_rpc', {
      p_items: items, p_reason: reason, p_supplier_name: supplierName,
    }, { label: 'createPurchaseReturn' });
  },

  async addEmployee(name: string, phone: string, role: string, type: string): Promise<string> {
    validateRequiredString(name, 'اسم الموظف');

    return safeRpc<string>('add_employee_rpc', {
      p_name: name, p_phone: phone, p_role: role, p_type: type,
    }, { label: 'addEmployee' });
  },

  async fetchEmployeeByCode(code: string) {
    const { data } = await supabase
      .from('pending_employees')
      .select('id,name,phone,role,employee_type,activation_code,is_used,created_at,organization_id,activated_at,activated_by')
      .eq('activation_code', code)
      .maybeSingle();
    return data ? transformPendingEmployee(data) : null;
  },

  async deactivateEmployee(employeeId: string): Promise<any> {
    validateUUID(employeeId, 'معرف الموظف');
    return safeRpc<any>('deactivate_employee_rpc', { p_employee_id: employeeId }, { label: 'deactivateEmployee' });
  },

  async reactivateEmployee(employeeId: string): Promise<any> {
    validateUUID(employeeId, 'معرف الموظف');
    return safeRpc<any>('reactivate_employee_rpc', { p_employee_id: employeeId }, { label: 'reactivateEmployee' });
  },
};
