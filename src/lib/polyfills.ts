/**
 * Polyfills for Android 8 (Chrome WebView 61-64) compatibility.
 * Must be imported BEFORE any app code in main.tsx.
 */

// Promise.allSettled — missing in Chrome < 76
if (typeof Promise.allSettled !== 'function') {
  Promise.allSettled = function <T extends readonly unknown[]>(
    promises: T
  ): Promise<{ status: 'fulfilled' | 'rejected'; value?: unknown; reason?: unknown }[]> {
    return Promise.all(
      Array.from(promises).map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason })
        )
      )
    );
  } as any;
}

// Array.prototype.flatMap — missing in Chrome < 69
if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function <U>(
    callback: (value: any, index: number, array: any[]) => U | U[],
    thisArg?: any
  ): U[] {
    return this.reduce((acc: U[], val: any, index: number) => {
      const result = callback.call(thisArg, val, index, this);
      return acc.concat(result);
    }, []);
  };
}

// Array.prototype.flat — missing in Chrome < 69
if (!Array.prototype.flat) {
  Array.prototype.flat = function (depth: number = 1): any[] {
    const flatten = (arr: any[], d: number): any[] =>
      d > 0
        ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice();
    return flatten(this, depth);
  };
}

// Object.fromEntries — missing in Chrome < 73
if (typeof Object.fromEntries !== 'function') {
  Object.fromEntries = function (entries: Iterable<[string, any]>): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, value] of entries) {
      obj[key] = value;
    }
    return obj;
  };
}

// globalThis — missing in Chrome < 71
if (typeof globalThis === 'undefined') {
  (window as any).globalThis = window;
}
