/**
 * Currency Service - Multi-Currency Management
 * 
 * Manages organization currencies (max 5) and exchange rates (immutable history).
 * All currency operations are additive — no breaking changes to existing pricing.
 * 
 * Android compatibility: API 26+ (uses standard ES2017 features only).
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface OrgCurrency {
  id: string;
  organization_id: string;
  currency_code: string;
  currency_name_ar: string;
  symbol: string | null;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  organization_id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_at: string;
  created_by: string | null;
  created_by_name: string | null;
  notes: string | null;
}

export const MAX_CURRENCIES_PER_ORG = 5;

const logErr = (ctx: string, error: unknown) => {
  logger.error(ctx, 'currencyService', { error: String((error as Error)?.message || error) });
};

export const currencyService = {
  /** List all currencies for an org. */
  async list(orgId: string): Promise<OrgCurrency[]> {
    const { data, error } = await supabase
      .from('org_currencies')
      .select('*')
      .eq('organization_id', orgId)
      .order('is_base', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) { logErr('list failed', error); throw error; }
    return (data ?? []) as OrgCurrency[];
  },

  /** Add a new currency. Enforces max 5 client-side. */
  async add(orgId: string, payload: {
    currency_code: string;
    currency_name_ar: string;
    symbol?: string;
  }): Promise<OrgCurrency> {
    const existing = await this.list(orgId);
    if (existing.length >= MAX_CURRENCIES_PER_ORG) {
      throw new Error(`الحد الأقصى ${MAX_CURRENCIES_PER_ORG} عملات لكل منشأة`);
    }
    if (existing.some(c => c.currency_code === payload.currency_code.toUpperCase())) {
      throw new Error('هذه العملة موجودة بالفعل');
    }
    const { data, error } = await supabase
      .from('org_currencies')
      .insert({
        organization_id: orgId,
        currency_code: payload.currency_code.toUpperCase(),
        currency_name_ar: payload.currency_name_ar,
        symbol: payload.symbol || null,
        is_base: false,
        is_active: true,
      })
      .select()
      .single();
    if (error) { logErr('add failed', error); throw error; }
    return data as OrgCurrency;
  },

  /** Toggle active state — base currency cannot be deactivated. */
  async toggleActive(currencyId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('org_currencies')
      .update({ is_active: isActive })
      .eq('id', currencyId);
    if (error) { logErr('toggleActive failed', error); throw error; }
  },

  /** List exchange rates for an org (history, newest first). */
  async listRates(orgId: string, limit = 100): Promise<ExchangeRate[]> {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('organization_id', orgId)
      .order('effective_at', { ascending: false })
      .limit(limit);
    if (error) { logErr('listRates failed', error); throw error; }
    return (data ?? []) as ExchangeRate[];
  },

  /** Add an immutable exchange rate entry. */
  async addRate(orgId: string, payload: {
    from_currency: string;
    to_currency: string;
    rate: number;
    notes?: string;
    created_by?: string | null;
    created_by_name?: string | null;
  }): Promise<ExchangeRate> {
    if (payload.rate <= 0) throw new Error('سعر الصرف يجب أن يكون أكبر من صفر');
    if (payload.from_currency === payload.to_currency) {
      throw new Error('لا يمكن تحويل العملة لنفسها');
    }
    const { data, error } = await supabase
      .from('exchange_rates')
      .insert({
        organization_id: orgId,
        from_currency: payload.from_currency.toUpperCase(),
        to_currency: payload.to_currency.toUpperCase(),
        rate: payload.rate,
        notes: payload.notes || null,
        created_by: payload.created_by ?? null,
        created_by_name: payload.created_by_name ?? null,
      })
      .select()
      .single();
    if (error) { logErr('addRate failed', error); throw error; }
    return data as ExchangeRate;
  },

  /** Get latest rate between two currencies (returns null if none). */
  getLatestRate(rates: ExchangeRate[], from: string, to: string): number | null {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return 1;
    const direct = rates.find(r => r.from_currency === f && r.to_currency === t);
    if (direct) return Number(direct.rate);
    const inverse = rates.find(r => r.from_currency === t && r.to_currency === f);
    if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);
    return null;
  },

  /** Convert amount between currencies using latest rates. */
  convert(amount: number, from: string, to: string, rates: ExchangeRate[]): number | null {
    const r = this.getLatestRate(rates, from, to);
    return r === null ? null : amount * r;
  },
};
