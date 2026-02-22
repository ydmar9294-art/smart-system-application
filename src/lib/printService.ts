/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         Enterprise Print Service — Capacitor Android         ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  ARCHITECTURE:                                               ║
 * ║  • Creates a hidden <iframe> INSIDE the existing Capacitor   ║
 * ║    WebView (already on UI thread → no thread violation)      ║
 * ║  • Writes self-contained HTML into iframe's srcdoc           ║
 * ║  • Waits for iframe load + requestAnimationFrame to ensure   ║
 * ║    layout is complete on UI thread                           ║
 * ║  • Calls iframe.contentWindow.print() which Capacitor        ║
 * ║    intercepts and routes to Android PrintManager             ║
 * ║  • Removes iframe after print dialog closes (afterprint)     ║
 * ║  • React DOM is NEVER touched → zero crash, zero reload      ║
 * ║                                                              ║
 * ║  WHY NOT body-swap?                                          ║
 * ║  body-swap destroys React DOM → state lost, app broken       ║
 * ║                                                              ║
 * ║  WHY NOT @capgo/capacitor-printer?                           ║
 * ║  Creates WebView in background thread → IllegalStateException ║
 * ║                                                              ║
 * ║  WHY iframe inside same document works?                      ║
 * ║  The iframe is created synchronously on the UI thread by     ║
 * ║  the JavaScript engine inside Capacitor's WebView. Android   ║
 * ║  PrintManager is triggered via window.print() which          ║
 * ║  Capacitor's WebChromeClient.onPrintRequested intercepts.    ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   import { printHTML } from '@/lib/printService';
 *   await printHTML(myHtmlString, 'فاتورة #123');
 */

const PRINT_TIMEOUT_MS = 90_000; // 90s hard fallback

/**
 * Print a complete <!DOCTYPE html>…</html> string.
 *
 * @param htmlContent  Full HTML document string (must include <html>, <head>, <body>)
 * @param jobName      Label shown as print job title
 */
export async function printHTML(
  htmlContent: string,
  jobName = 'فاتورة'
): Promise<void> {
  if (!htmlContent || htmlContent.trim().length < 20) {
    console.warn('[PrintService] Empty content — aborting');
    return;
  }

  return new Promise<void>((resolve) => {
    let iframe: HTMLIFrameElement | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    // ── Cleanup: remove iframe and settle promise ──────────────────────────
    const cleanup = () => {
      if (settled) return;
      settled = true;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Remove iframe after a short delay so PrintManager can finish reading
      setTimeout(() => {
        try {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (_) { /* ignore */ }
        iframe = null;
        resolve();
      }, 500);
    };

    // ── Hard timeout fallback ──────────────────────────────────────────────
    timeoutId = setTimeout(() => {
      console.warn('[PrintService] Hard timeout reached — cleaning up');
      cleanup();
    }, PRINT_TIMEOUT_MS);

    try {
      // ── 1. Create invisible iframe ──────────────────────────────────────
      iframe = document.createElement('iframe');

      Object.assign(iframe.style, {
        position:   'fixed',
        top:        '-9999px',
        left:       '-9999px',
        width:      '1px',
        height:     '1px',
        border:     'none',
        visibility: 'hidden',
        pointerEvents: 'none',
      });

      // Set title so Android uses it as print job name
      iframe.title = jobName;

      // ── 2. Write invoice HTML into iframe via srcdoc ────────────────────
      // srcdoc is synchronous and same-origin → contentWindow accessible
      iframe.srcdoc = htmlContent;

      // ── 3. Attach to DOM (triggers layout on UI thread) ─────────────────
      document.body.appendChild(iframe);

      // ── 4. Wait for iframe to fully load, then print ────────────────────
      iframe.addEventListener('load', () => {
        // requestAnimationFrame ensures we're on next UI paint cycle
        // giving Android WebView time to fully layout the iframe content
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              const win = iframe?.contentWindow;
              if (!win) {
                console.error('[PrintService] iframe contentWindow is null');
                cleanup();
                return;
              }

              // Set document title inside iframe (print job name on some Android versions)
              try {
                if (iframe?.contentDocument) {
                  iframe.contentDocument.title = jobName;
                }
              } catch (_) { /* cross-origin safety */ }

              // ── 5. Listen for afterprint BEFORE calling print() ─────────
              win.addEventListener('afterprint', () => {
                cleanup();
              }, { once: true });

              // Also listen on main window (some Android versions fire it here)
              const mainWindowAfterPrint = () => {
                cleanup();
              };
              window.addEventListener('afterprint', mainWindowAfterPrint, { once: true });

              // ── 6. Trigger Android PrintManager ─────────────────────────
              // Small delay after rAF to ensure styles are fully painted
              setTimeout(() => {
                try {
                  win.print();
                } catch (printErr) {
                  console.error('[PrintService] print() call failed:', printErr);
                  window.removeEventListener('afterprint', mainWindowAfterPrint);
                  cleanup();
                }
              }, 200);

            } catch (err) {
              console.error('[PrintService] Error in rAF callback:', err);
              cleanup();
            }
          });
        });
      }, { once: true });

      // ── Safety: if load event never fires ──────────────────────────────
      iframe.addEventListener('error', () => {
        console.error('[PrintService] iframe failed to load');
        cleanup();
      }, { once: true });

    } catch (outerErr) {
      console.error('[PrintService] Outer error:', outerErr);
      cleanup();
    }
  });
}
