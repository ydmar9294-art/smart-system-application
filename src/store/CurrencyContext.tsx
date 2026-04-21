/**
 * CurrencyContext — Provides org currencies + exchange rates
 * 
 * - Loads currencies and recent exchange rates for the current org
 * - Exposes refresh + helper to get latest rate
 * - Read-only for non-owners (RLS enforces write permissions)
 * - In guest mode returns empty arrays (no-op)
 * 
 * Android API 26+ compatible (no top-level await, no optional chaining in legacy contexts).
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { currencyService, OrgCurrency, ExchangeRate } from '@/services/currencyService';
import { getUsdToSypRate } from '@/lib/priceConversion';
import { logger } from '@/lib/logger';

interface CurrencyContextType {
  currencies: OrgCurrency[];
  rates: ExchangeRate[];
  baseCurrency: OrgCurrency | null;
  /** Latest "1 USD = X SYP" rate, or null when not yet set. */
  usdRate: number | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  getLatestRate: (from: string, to: string) => number | null;
  convert: (amount: number, from: string, to: string) => number | null;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const [currencies, setCurrencies] = useState<OrgCurrency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) {
      setCurrencies([]);
      setRates([]);
      return;
    }
    setIsLoading(true);
    try {
      const [c, r] = await Promise.all([
        currencyService.list(orgId),
        currencyService.listRates(orgId, 200),
      ]);
      setCurrencies(c);
      setRates(r);
    } catch (e) {
      logger.warn('CurrencyContext refresh failed', 'currency', { error: String((e as Error)?.message || e) });
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const baseCurrency = useMemo(
    () => currencies.find(c => c.is_base) ?? null,
    [currencies]
  );

  const usdRate = useMemo(() => getUsdToSypRate(rates), [rates]);

  const getLatestRate = useCallback(
    (from: string, to: string) => currencyService.getLatestRate(rates, from, to),
    [rates]
  );

  const convert = useCallback(
    (amount: number, from: string, to: string) => currencyService.convert(amount, from, to, rates),
    [rates]
  );

  const value = useMemo<CurrencyContextType>(() => ({
    currencies,
    rates,
    baseCurrency,
    usdRate,
    isLoading,
    refresh,
    getLatestRate,
    convert,
  }), [currencies, rates, baseCurrency, usdRate, isLoading, refresh, getLatestRate, convert]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextType => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Safe fallback for guest mode / unmounted providers
    return {
      currencies: [],
      rates: [],
      baseCurrency: null,
      usdRate: null,
      isLoading: false,
      refresh: async () => {},
      getLatestRate: () => null,
      convert: () => null,
    };
  }
  return ctx;
};
