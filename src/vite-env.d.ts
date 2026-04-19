/// <reference types="vite/client" />

// react-i18next is aliased to a local shim in vite.config.ts.
// Provide a module declaration so TypeScript doesn't complain.
declare module 'react-i18next' {
  export * from '@/lib/i18nShim';
}
declare module 'i18next' {
  export * from '@/lib/i18nShim';
}
declare module 'i18next-browser-languagedetector' {
  const detector: any;
  export default detector;
}
