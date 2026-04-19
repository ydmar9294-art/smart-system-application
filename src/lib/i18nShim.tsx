/**
 * i18n Shim — Arabic-only replacement for react-i18next
 * 
 * This file provides a 100% API-compatible drop-in replacement for the
 * `react-i18next` package. All `useTranslation()`, `Trans`, `i18n.t()`,
 * `i18n.language`, `i18n.changeLanguage()`, `i18n.exists()` calls work
 * exactly as before — but the language is permanently locked to Arabic
 * and translations are read directly from `src/locales/ar.ts`.
 * 
 * This avoids editing 200+ component files while completely removing
 * the i18next runtime (~150KB of JS) from the bundle.
 */
import React from 'react';
import ar from '@/locales/ar';

// ============================================
// Translation Resolution
// ============================================

/**
 * Resolve a dotted key path (e.g. "common.save") against the Arabic dictionary.
 */
function resolveKey(key: string): string | undefined {
  if (!key) return undefined;
  const parts = key.split('.');
  let current: any = ar;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate {{variable}} placeholders.
 */
function interpolate(template: string, vars: Record<string, any>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  });
}

export type TFunction = (key: string | string[], options?: any) => string;

const tImpl: TFunction = (key, options) => {
  // Support array of keys (i18next behavior: try each, fall back to last)
  if (Array.isArray(key)) {
    for (const k of key) {
      const found = resolveKey(k);
      if (found != null) return interpolate(found, options || {});
    }
    // Honor explicit defaultValue option, else return last key string
    if (options && typeof options === 'object' && 'defaultValue' in options) {
      return interpolate(String(options.defaultValue), options);
    }
    return key[key.length - 1];
  }

  const found = resolveKey(key);
  if (found != null) {
    return interpolate(found, options || {});
  }

  // Fallbacks
  if (options && typeof options === 'object' && 'defaultValue' in options) {
    return interpolate(String(options.defaultValue), options);
  }
  return key;
};

// ============================================
// i18n Object (mimics i18next instance)
// ============================================

type LanguageChangedHandler = (lng: string) => void;
const languageChangedHandlers: Set<LanguageChangedHandler> = new Set();

export const i18n = {
  language: 'ar' as const,
  languages: ['ar'] as const,
  isInitialized: true,
  t: tImpl,
  exists: (key: string): boolean => resolveKey(key) != null,
  /**
   * No-op — language is locked to Arabic.
   * Kept for backward compatibility with any code that calls it.
   */
  changeLanguage: (_lng?: string): Promise<TFunction> => {
    return Promise.resolve(tImpl);
  },
  on: (event: string, handler: LanguageChangedHandler) => {
    if (event === 'languageChanged') languageChangedHandlers.add(handler);
  },
  off: (event: string, handler: LanguageChangedHandler) => {
    if (event === 'languageChanged') languageChangedHandlers.delete(handler);
  },
  addResourceBundle: (_lng: string, _ns: string, _resources: any) => {
    // No-op — translations are static
  },
  loadNamespaces: (_ns: string | string[]): Promise<void> => Promise.resolve(),
  loadLanguages: (_lng: string | string[]): Promise<void> => Promise.resolve(),
  hasResourceBundle: (_lng: string, _ns: string): boolean => true,
  getFixedT: (_lng?: string | null, _ns?: string | null) => tImpl,
  use: () => i18n, // Chainable .use() for any leftover .use(initReactI18next) calls
  init: (): Promise<TFunction> => Promise.resolve(tImpl),
  dir: () => 'rtl' as const,
};

// Default export = i18n instance (matches `import i18n from '@/lib/i18n'`)
export default i18n;

// ============================================
// useTranslation Hook
// ============================================

export interface UseTranslationResponse {
  t: TFunction;
  i18n: typeof i18n;
  ready: boolean;
}

export function useTranslation(_ns?: string | string[], _options?: any): UseTranslationResponse {
  return { t: tImpl, i18n, ready: true };
}

// ============================================
// Trans Component (renders interpolated string)
// ============================================

export interface TransProps {
  i18nKey?: string;
  values?: Record<string, any>;
  defaults?: string;
  children?: React.ReactNode;
  components?: React.ReactNode[] | { [k: string]: React.ReactNode };
  count?: number;
}

export const Trans: React.FC<TransProps> = ({ i18nKey, values, defaults, children }) => {
  if (i18nKey) {
    const text = tImpl(i18nKey, { ...values, defaultValue: defaults });
    return <>{text}</>;
  }
  if (defaults) return <>{interpolate(defaults, values || {})}</>;
  return <>{children}</>;
};

// ============================================
// Compatibility shims for any `import { ... } from 'react-i18next'`
// ============================================

export const initReactI18next = {
  type: '3rdParty' as const,
  init: () => {},
};

export const I18nextProvider: React.FC<{ i18n?: any; children: React.ReactNode }> = ({ children }) => <>{children}</>;

export const withTranslation = () => <P extends object>(Component: React.ComponentType<P & UseTranslationResponse>) => {
  const Wrapped: React.FC<P> = (props) => <Component {...(props as P)} t={tImpl} i18n={i18n} ready={true} />;
  Wrapped.displayName = `withTranslation(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
};
