/**
 * CSP Configuration & Documentation
 * 
 * This module documents the Content Security Policy decisions and provides
 * utilities for CSP-compliant dynamic content handling.
 * 
 * ## CSP Directives Explained
 * 
 * ### script-src 'self' 'wasm-unsafe-eval'
 * - 'self': Only scripts from our origin are allowed
 * - 'wasm-unsafe-eval': Required for WebAssembly (NOT the same as 'unsafe-eval')
 * - No 'unsafe-inline': All scripts must be external files (Vite handles this)
 * - No 'unsafe-eval': No eval(), new Function(), or setTimeout(string)
 * 
 * ### style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
 * - 'unsafe-inline' is REQUIRED because:
 *   1. Radix UI injects inline styles for popovers, dialogs, tooltips
 *   2. framer-motion injects inline styles for animations
 *   3. React itself uses inline style props
 *   NOTE: This cannot be replaced with nonces in a static SPA without
 *   a server-side rendering layer to generate per-request nonces.
 * 
 * ### Additional hardening directives
 * - base-uri 'self': Prevents base tag hijacking
 * - form-action 'self': Prevents form submission to foreign origins
 * - object-src 'none': Blocks Flash/Java plugins entirely
 * - upgrade-insecure-requests: Forces HTTPS for all sub-resources
 * 
 * ## Why no nonce-based CSP?
 * This is a static SPA served from a CDN. Nonces require a server to generate
 * a unique value per HTTP response. The CSP is set via <meta> tag, which does
 * not support nonces in practice (the nonce would be the same for every page load,
 * defeating its purpose). To achieve nonce-based CSP, deploy behind a reverse
 * proxy (e.g., Cloudflare Workers) that injects the CSP header with a fresh nonce.
 */

/**
 * Safely set CSS custom properties on an element.
 * Use this instead of dangerouslySetInnerHTML for dynamic styles.
 */
export function setCSSVariable(element: HTMLElement, name: string, value: string): void {
  // Validate variable name (only allow --word-chars)
  if (!/^--[a-zA-Z0-9_-]+$/.test(name)) {
    return;
  }
  element.style.setProperty(name, value);
}

/**
 * Create a style element with textContent (CSP-safe, no innerHTML).
 */
export function createSafeStyleElement(css: string, id?: string): HTMLStyleElement {
  const style = document.createElement('style');
  if (id) style.setAttribute('data-style-id', id);
  style.textContent = css; // textContent is CSP-safe, innerHTML is not
  return style;
}
