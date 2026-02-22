/**
 * Circuit Breaker Pattern (Phase 6)
 * Prevents cascading failures under heavy load.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast with cached fallback
 * - HALF_OPEN: Testing if service recovered (one request allowed)
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Max failures before opening circuit */
  failureThreshold?: number;
  /** How long to stay open before testing (ms) */
  resetTimeout?: number;
  /** Name for logging */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30_000; // 30s
    this.name = options.name ?? 'default';
  }

  async execute<T>(
    request: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        // Fail fast
        if (fallback) return fallback();
        throw new Error(`[CircuitBreaker:${this.name}] Circuit is OPEN — failing fast`);
      }
    }

    try {
      const result = await request();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
  }
}

// Singleton breakers for key subsystems
export const authCircuitBreaker = new CircuitBreaker({
  name: 'auth',
  failureThreshold: 3,
  resetTimeout: 15_000,
});

export const dataCircuitBreaker = new CircuitBreaker({
  name: 'data',
  failureThreshold: 5,
  resetTimeout: 30_000,
});
