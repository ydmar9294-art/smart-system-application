/**
 * Sales Service - All sales-related Supabase operations
 * Contexts/hooks call this layer; never call Supabase directly for sales.
 */
import { supabase } from '@/integrations/supabase/client';
import { safeRpc, safeQuery, validateUUID, validateNonEmptyArray, validateRequiredString, validatePositiveNumber } from '@/lib/safeQuery';
import { Sale } from '@/types';
import { transformSale } from '@/hooks/useDataOperations';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

export interface CreateSaleParams {
  customerId: string;
  items: any[];
  paymentType?: string;
  discountType?: string;
  discountValue?: number;
  discountPercentage?: number;
}

export interface VoidSaleParams {
  saleId: string;
  reason: string;
}

export const salesService = {
  async fetchSales(orgId: string, isDeveloper: boolean, cursor?: string, limit = 50): Promise<{ data: Sale[]; nextCursor: string | null }> {
    const end = performanceMonitor.startTimer('salesService.fetchSales');
    try {
      let query = supabase
        .from('sales')
        .select('id,customer_id,customer_name,grand_total,paid_amount,remaining,payment_type,is_voided,void_reason,created_at,organization_id,created_by')
        .order('created_at', { ascending: false })
        .limit(limit + 1); // fetch one extra to determine if there's a next page

      if (!isDeveloper) {
        query = query.eq('organization_id', orgId);
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const data = await safeQuery(() => query, { label: 'sales' });
      const rows = data || [];
      const hasMore = rows.length > limit;
      const pageData = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? pageData[pageData.length - 1].created_at : null;

      return {
        data: pageData.map(transformSale),
        nextCursor,
      };
    } finally {
      end();
    }
  },

  async createSale(params: CreateSaleParams): Promise<string> {
    validateUUID(params.customerId, 'معرف العميل');
    validateNonEmptyArray(params.items, 'أصناف الفاتورة');

    const rpcParams: Record<string, any> = {
      p_customer_id: params.customerId,
      p_items: params.items,
      p_payment_type: params.paymentType,
    };
    if (params.discountType) {
      rpcParams.p_discount_type = params.discountType;
      rpcParams.p_discount_value = params.discountValue;
      rpcParams.p_discount_percentage = params.discountPercentage;
    }

    return safeRpc<string>('create_sale_rpc', rpcParams, { label: 'createSale' });
  },

  async voidSale(params: VoidSaleParams): Promise<void> {
    validateUUID(params.saleId, 'معرف الفاتورة');
    validateRequiredString(params.reason, 'سبب الإلغاء');

    await safeRpc('void_sale_rpc', { p_sale_id: params.saleId, p_reason: params.reason }, { label: 'voidSale' });
  },
};
