import { CircuitBreaker, CircuitBreakerOpenException } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state and allows execution', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    expect(cb.getState()).toBe('CLOSED');
    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('opens circuit after failureThreshold consecutive failures', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    await expect(
      cb.execute(async () => {
        throw new Error('fail 1');
      }),
    ).rejects.toThrow('fail 1');

    await expect(
      cb.execute(async () => {
        throw new Error('fail 2');
      }),
    ).rejects.toThrow('fail 2');

    expect(cb.getState()).toBe('OPEN');

    // Subsequent call should fail fast with CircuitBreakerOpenException
    await expect(cb.execute(async () => 'ok')).rejects.toThrow(
      CircuitBreakerOpenException,
    );
  });

  it('resets failure count on success', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    await expect(
      cb.execute(async () => {
        throw new Error('fail 1');
      }),
    ).rejects.toThrow();

    await cb.execute(async () => 'success');

    // Requires 2 more failures to open
    await expect(
      cb.execute(async () => {
        throw new Error('fail 2');
      }),
    ).rejects.toThrow();

    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions to HALF_OPEN after resetTimeoutMs', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 1,
      resetTimeoutMs: 5000,
    });

    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow();

    expect(cb.getState()).toBe('OPEN');

    // Advance time by 5001ms
    jest.advanceTimersByTime(5001);

    expect(cb.getState()).toBe('HALF_OPEN');

    // Next successful execution closes circuit
    const res = await cb.execute(async () => 'recovered');
    expect(res).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');

    jest.useRealTimers();
  });
});
