/**
 * Price Conversion Utilities — SYP/USD only
 *
 * The system supports two currencies: Syrian Pound (SYP) and US Dollar (USD).
 * The exchange rate is always expressed as: 1 USD = X SYP.
 *
 * Products may be priced in either SYP or USD (per `product.pricingCurrency`).
 * When displaying prices on invoices and sales screens, we always convert to SYP
 * using the latest known rate.
 */
import type { ExchangeRate } from '@/services/currencyService';
import type { Product, PricingCurrency } from '@/types';

/**
 * Returns the latest "1 USD = X SYP" rate from the rates list.
 * Falls back to `null` when no rate is available.
 */
export function getUsdToSypRate(rates: ExchangeRate[]): number | null {
  if (!rates || rates.length === 0) return null;
  // rates are listed newest-first by listRates()
  const direct = rates.find(r => r.from_currency === 'USD' && r.to_currency === 'SYP');
  if (direct && Number(direct.rate) > 0) return Number(direct.rate);
  const inverse = rates.find(r => r.from_currency === 'SYP' && r.to_currency === 'USD');
  if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);
  return null;
}

/**
 * Converts a price value from a source currency into SYP using the given USD rate.
 * - If `sourceCurrency` is SYP → returns the value as-is.
 * - If `sourceCurrency` is USD → multiplies by the USD→SYP rate.
 * - If no rate is available for USD → returns `null` (caller should handle).
 */
export function toSyp(
  amount: number,
  sourceCurrency: PricingCurrency,
  usdRate: number | null,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (sourceCurrency === 'SYP') return amount;
  if (usdRate === null || usdRate <= 0) return null;
  return amount * usdRate;
}

/**
 * Resolves the SYP price of a product (base price) given the latest USD rate.
 * Returns 0 when no conversion is possible (defensive default).
 */
export function resolveProductBasePriceSYP(product: Product, usdRate: number | null): number {
  return toSyp(Number(product.basePrice) || 0, product.pricingCurrency, usdRate) ?? 0;
}

/**
 * Resolves the SYP consumer price of a product given the latest USD rate.
 */
export function resolveProductConsumerPriceSYP(product: Product, usdRate: number | null): number {
  return toSyp(Number(product.consumerPrice) || 0, product.pricingCurrency, usdRate) ?? 0;
}

/**
 * Helper: format a SYP amount with the Arabic suffix.
 */
export function formatSyp(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ل.س`;
}
