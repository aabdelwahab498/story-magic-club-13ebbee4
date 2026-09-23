import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // e.g. 5 failures before opening
  cooldownMs?: number; // e.g. 30,000ms cooldown before HALF_OPEN
  resetTimeoutMs?: number; // alias for cooldownMs
  name?: string;
}

export class CircuitBreakerOpenException extends Error {
  constructor(name: string, cooldownRemainingMs: number) {
    super(
      `Circuit breaker '${name}' is OPEN. Requests blocked for ${Math.ceil(cooldownRemainingMs / 1000)}s`,
    );
    this.name = 'CircuitBreakerOpenException';
  }
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(name: string, options?: CircuitBreakerOptions);
  constructor(options?: CircuitBreakerOptions);
  constructor(
    nameOrOptions?: string | CircuitBreakerOptions,
    options?: CircuitBreakerOptions,
  ) {
    if (typeof nameOrOptions === 'string') {
      this.name = nameOrOptions;
      const opts = options || {};
      this.failureThreshold = opts.failureThreshold ?? 5;
      this.cooldownMs = opts.cooldownMs ?? opts.resetTimeoutMs ?? 30000;
    } else {
      const opts = nameOrOptions || {};
      this.name = opts.name || 'default';
      this.failureThreshold = opts.failureThreshold ?? 5;
      this.cooldownMs = opts.cooldownMs ?? opts.resetTimeoutMs ?? 30000;
    }

    this.logger = new Logger(`CircuitBreaker:${this.name}`);
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
      this.state = CircuitState.HALF_OPEN;
      this.logger.log(
        `Circuit '${this.name}' transitioned from OPEN to HALF_OPEN (probing next request)`,
      );
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      const cooldownRemaining = Math.max(0, this.nextAttemptTime - Date.now());
      throw new CircuitBreakerOpenException(this.name, cooldownRemaining);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger.log(
        `Circuit '${this.name}' probe succeeded. Transitioning from HALF_OPEN to CLOSED`,
      );
    }
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
  }

  private onFailure(err: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.logger.warn(
      `Circuit '${this.name}' recorded failure (${this.failureCount}/${this.failureThreshold}): ${err.message}`,
    );

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.cooldownMs;
      this.logger.error(
        `Circuit '${this.name}' transitioned to OPEN for ${this.cooldownMs / 1000}s`,
      );
    }
  }
}
