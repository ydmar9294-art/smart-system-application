/**
 * Collection (Payment) Service - All collection-related Supabase operations
 */
import { safeRpc, validateUUID, validatePositiveNumber, validateRequiredString } from '@/lib/safeQuery';

export const collectionService = {
  async addCollection(saleId: string, amount: number, notes?: string): Promise<string> {
    validateUUID(saleId, 'معرف الفاتورة');
    validatePositiveNumber(amount, 'مبلغ التحصيل');

    return safeRpc<string>('add_collection_rpc', {
      p_sale_id: saleId, p_amount: amount, p_notes: notes,
    }, { label: 'addCollection' });
  },

  async reversePayment(paymentId: string, reason: string): Promise<void> {
    validateUUID(paymentId, 'معرف الدفعة');
    validateRequiredString(reason, 'سبب العكس');

    await safeRpc('reverse_payment_rpc', {
      p_payment_id: paymentId, p_reason: reason,
    }, { label: 'reversePayment' });
  },
};
