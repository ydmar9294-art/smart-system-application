/**
 * Shared list of common currencies used across signup, settings,
 * and the multi-currency manager. Keep additive — never rename codes.
 */
export interface CurrencyPreset {
  code: string;
  name_ar: string;
  symbol: string;
}

export const COMMON_CURRENCIES: CurrencyPreset[] = [
  { code: 'SYP', name_ar: 'ليرة سورية',     symbol: 'ل.س' },
  { code: 'USD', name_ar: 'دولار أمريكي',    symbol: '$'   },
  { code: 'EUR', name_ar: 'يورو',            symbol: '€'   },
  { code: 'TRY', name_ar: 'ليرة تركية',      symbol: '₺'   },
  { code: 'SAR', name_ar: 'ريال سعودي',      symbol: '﷼'   },
  { code: 'AED', name_ar: 'درهم إماراتي',    symbol: 'د.إ' },
  { code: 'JOD', name_ar: 'دينار أردني',     symbol: 'د.أ' },
  { code: 'EGP', name_ar: 'جنيه مصري',       symbol: 'ج.م' },
];
