/**
 * Collection (Payment) Service - All collection-related Supabase operations
 *
 * Supports two directions:
 *  - IN  (سند قبض): money received from a customer against a sale invoice
 *  - OUT (سند دفع): money paid back to a customer who has a credit balance
 *
 * Both directions support multi-currency input (SYP / USD). The amount stored
 * in the DB is always in SYP (computed from original_amount * exchange_rate
 * for USD), with the original currency and rate preserved for auditing.
 */
import { safeRpc, validateUUID, validatePositiveNumber, validateRequiredString } from '@/lib/safeQuery';

export type CollectionCurrency = 'SYP' | 'USD';

export interface CollectionCurrencyMeta {
  currency?: CollectionCurrency;
  originalAmount?: number;
  exchangeRate?: number;
}

export const collectionService = {
  async addCollection(
    saleId: string,
    amount: number,
    notes?: string,
    meta?: CollectionCurrencyMeta,
  ): Promise<string> {
    validateUUID(saleId, 'معرف الفاتورة');
    validatePositiveNumber(amount, 'مبلغ التحصيل');

    return safeRpc<string>('add_collection_rpc', {
      p_sale_id: saleId,
      p_amount: amount,
      p_notes: notes,
      p_currency: meta?.currency ?? 'SYP',
      p_original_amount: meta?.originalAmount ?? amount,
      p_exchange_rate: meta?.exchangeRate ?? 1,
    }, { label: 'addCollection' });
  },

  async addPaymentOut(
    customerId: string,
    amount: number,
    meta: CollectionCurrencyMeta & { notes?: string },
  ): Promise<string> {
    validateUUID(customerId, 'معرف الزبون');
    validatePositiveNumber(amount, 'مبلغ الدفع');

    return safeRpc<string>('add_payment_out_rpc', {
      p_customer_id: customerId,
      p_amount: amount,
      p_currency: meta.currency ?? 'SYP',
      p_original_amount: meta.originalAmount ?? amount,
      p_exchange_rate: meta.exchangeRate ?? 1,
      p_notes: meta.notes,
    }, { label: 'addPaymentOut' });
  },

  async reversePayment(paymentId: string, reason: string): Promise<void> {
    validateUUID(paymentId, 'معرف الدفعة');
    validateRequiredString(reason, 'سبب العكس');

    await safeRpc('reverse_payment_rpc', {
      p_payment_id: paymentId, p_reason: reason,
    }, { label: 'reversePayment' });
  },
};
