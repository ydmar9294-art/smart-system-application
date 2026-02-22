/**
 * Concurrency Utilities
 * Prevents race conditions and ensures data integrity in concurrent operations
 */

// ============================================
// Mutex Implementation
// ============================================

/**
 * Simple mutex for ensuring exclusive access to critical sections
 */
export class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

// ============================================
// Request Queue
// ============================================

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Serial request queue for operations that must not run concurrently
 * e.g., financial operations on the same sale
 */
export class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private isProcessing = false;

  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  clear(): void {
    const remaining = this.queue.splice(0);
    remaining.forEach(req => req.reject(new Error('Queue cleared')));
  }

  get length(): number {
    return this.queue.length;
  }
}

// ============================================
// Debouncer
// ============================================

/**
 * Debounce class for preventing rapid consecutive calls
 */
export class Debouncer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  debounce(fn: () => void, delay: number): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      fn();
      this.timeoutId = null;
    }, delay);
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  isPending(): boolean {
    return this.timeoutId !== null;
  }
}

// ============================================
// Throttler
// ============================================

/**
 * Throttle class for limiting call frequency
 */
export class Throttler {
  private lastCall = 0;
  private pendingCall: ReturnType<typeof setTimeout> | null = null;

  throttle(fn: () => void, limit: number): void {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;

    if (timeSinceLastCall >= limit) {
      this.lastCall = now;
      fn();
    } else if (!this.pendingCall) {
      const delay = limit - timeSinceLastCall;
      this.pendingCall = setTimeout(() => {
        this.lastCall = Date.now();
        this.pendingCall = null;
        fn();
      }, delay);
    }
  }

  cancel(): void {
    if (this.pendingCall) {
      clearTimeout(this.pendingCall);
      this.pendingCall = null;
    }
  }
}

// ============================================
// Request Deduplicator
// ============================================

/**
 * Deduplicates concurrent identical requests
 * Multiple callers waiting for the same data will share one request
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, request: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = request().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  hasPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// ============================================
// Singleton Instances for Global Use
// ============================================

// Auth operations mutex - ensures only one auth operation at a time
export const authMutex = new Mutex();

// Data refresh deduplicator - prevents duplicate refresh calls
export const refreshDeduplicator = new RequestDeduplicator();

// Financial operations queue - ensures serial processing
export const financialOperationsQueue = new RequestQueue();

// Data refresh debouncer - prevents rapid consecutive refreshes
export const refreshDebouncer = new Debouncer();
