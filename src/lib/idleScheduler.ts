/**
 * Idle Scheduler — defers non-critical work to browser idle time
 * Critical for low-end Android 8 devices (2GB RAM) to keep UI responsive.
 *
 * Usage:
 *   scheduleIdle(() => doExpensiveWork(), { timeout: 2000 });
 *   await runWhenIdle(() => generatePdf());
 */

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

const hasIdleCallback = typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function';

/**
 * Schedule a non-critical callback during idle time.
 * Falls back to setTimeout(100) on platforms without requestIdleCallback (Safari/older WebViews).
 */
export function scheduleIdle(fn: IdleCallback | (() => void), opts?: { timeout?: number }): number {
  const timeout = opts?.timeout ?? 2000;
  if (hasIdleCallback) {
    return (window as any).requestIdleCallback(fn, { timeout });
  }
  return window.setTimeout(() => {
    (fn as IdleCallback)({ didTimeout: true, timeRemaining: () => 0 });
  }, 100);
}

export function cancelIdle(id: number): void {
  if (hasIdleCallback && typeof (window as any).cancelIdleCallback === 'function') {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Promise-based: resolves when the browser is idle.
 * Useful before launching heavy operations like PDF generation.
 */
export function runWhenIdle<T>(fn: () => T | Promise<T>, timeout = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    scheduleIdle(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    }, { timeout });
  });
}

/**
 * Yield to the event loop — useful inside long synchronous loops
 * to prevent blocking the main thread on low-end devices.
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof (window as any).scheduler?.yield === 'function') {
      (window as any).scheduler.yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}
