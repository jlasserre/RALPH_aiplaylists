/**
 * Tests for exponential backoff utility
 */

import {
  calculateBackoffDelay,
  calculateDelayWithRetryAfter,
  getBackoffResult,
  delay,
  withBackoff,
  DEFAULT_BACKOFF_CONFIG,
  type BackoffConfig,
} from './backoff';

describe('calculateBackoffDelay', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should calculate exponential delay for first attempt', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // attempt 0: 1000 * 2^0 = 1000ms
    expect(calculateBackoffDelay(0, config)).toBe(1000);
  });

  it('should calculate exponential delay for subsequent attempts', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // attempt 1: 1000 * 2^1 = 2000ms
    expect(calculateBackoffDelay(1, config)).toBe(2000);
    // attempt 2: 1000 * 2^2 = 4000ms
    expect(calculateBackoffDelay(2, config)).toBe(4000);
    // attempt 3: 1000 * 2^3 = 8000ms
    expect(calculateBackoffDelay(3, config)).toBe(8000);
  });

  it('should cap delay at maxDelayMs', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, maxDelayMs: 5000, jitterFactor: 0 };
    // attempt 3: 1000 * 2^3 = 8000ms, capped at 5000ms
    expect(calculateBackoffDelay(3, config)).toBe(5000);
  });

  it('should add jitter to delay', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0.1 };
    // attempt 0: base = 1000, jitter = 1000 * 0.1 * 0.5 = 50
    const result = calculateBackoffDelay(0, config);
    expect(result).toBe(1050);
  });

  it('should use custom baseDelayMs', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, baseDelayMs: 500, jitterFactor: 0 };
    // attempt 0: 500 * 2^0 = 500ms
    expect(calculateBackoffDelay(0, config)).toBe(500);
    // attempt 1: 500 * 2^1 = 1000ms
    expect(calculateBackoffDelay(1, config)).toBe(1000);
  });

  it('should floor the result to integer', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0.1 };
    jest.spyOn(Math, 'random').mockReturnValue(0.333);
    // attempt 0: base = 1000, jitter = 1000 * 0.1 * 0.333 = 33.3, total = 1033.3
    const result = calculateBackoffDelay(0, config);
    expect(result).toBe(1033);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('calculateDelayWithRetryAfter', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should use Retry-After when provided', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // Retry-After: 5 seconds = 5000ms
    expect(calculateDelayWithRetryAfter(0, 5, config)).toBe(5000);
  });

  it('should cap Retry-After at maxDelayMs', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, maxDelayMs: 10000 };
    // Retry-After: 60 seconds = 60000ms, capped at 10000ms
    expect(calculateDelayWithRetryAfter(0, 60, config)).toBe(10000);
  });

  it('should use exponential backoff when Retry-After is null', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // attempt 1: 1000 * 2^1 = 2000ms
    expect(calculateDelayWithRetryAfter(1, null, config)).toBe(2000);
  });

  it('should use exponential backoff when Retry-After is 0', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // Retry-After 0 is not valid, use exponential backoff
    expect(calculateDelayWithRetryAfter(0, 0, config)).toBe(1000);
  });

  it('should use exponential backoff when Retry-After is negative', () => {
    const config = { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 };
    // Retry-After -5 is not valid, use exponential backoff
    expect(calculateDelayWithRetryAfter(0, -5, config)).toBe(1000);
  });
});

describe('getBackoffResult', () => {
  it('should return shouldRetry=true for 429 status on first attempt', () => {
    const result = getBackoffResult(1, 429, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
    expect(result.attempt).toBe(1);
  });

  it('should return shouldRetry=true for 500 status', () => {
    const result = getBackoffResult(1, 500, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
  });

  it('should return shouldRetry=true for 502 status', () => {
    const result = getBackoffResult(1, 502, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
  });

  it('should return shouldRetry=true for 503 status', () => {
    const result = getBackoffResult(1, 503, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
  });

  it('should return shouldRetry=false for 400 status', () => {
    const result = getBackoffResult(1, 400, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
  });

  it('should return shouldRetry=false for 401 status', () => {
    const result = getBackoffResult(1, 401, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
  });

  it('should return shouldRetry=false for 403 status', () => {
    const result = getBackoffResult(1, 403, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
  });

  it('should return shouldRetry=false for 404 status', () => {
    const result = getBackoffResult(1, 404, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
  });

  it('should return shouldRetry=false when max retries exceeded', () => {
    // With maxRetries=3, attempt 4 should not retry (we've done 3 retries already)
    const result = getBackoffResult(4, 429, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
    expect(result.attempt).toBe(4);
  });

  it('should return shouldRetry=true when attempt equals maxRetries', () => {
    // With maxRetries=3, attempt 3 should still retry (we have one more retry left)
    const result = getBackoffResult(3, 429, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
    expect(result.attempt).toBe(3);
  });

  it('should return shouldRetry=true when attempts < maxRetries', () => {
    const result = getBackoffResult(2, 429, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(true);
    expect(result.attempt).toBe(2);
  });

  it('should use Retry-After for delay when provided', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = getBackoffResult(1, 429, 10, { maxRetries: 3 });
    expect(result.delayMs).toBe(10000); // 10 seconds
    jest.restoreAllMocks();
  });

  it('should use default config when not provided', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = getBackoffResult(1, 429);
    expect(result.shouldRetry).toBe(true);
    expect(result.delayMs).toBe(1000); // default baseDelayMs
    jest.restoreAllMocks();
  });

  it('should return delayMs=0 when shouldRetry is false', () => {
    const result = getBackoffResult(1, 400, null, { maxRetries: 3 });
    expect(result.shouldRetry).toBe(false);
    expect(result.delayMs).toBe(0);
  });
});

describe('delay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve after specified milliseconds', async () => {
    const delayPromise = delay(1000);

    jest.advanceTimersByTime(999);
    expect(jest.getTimerCount()).toBe(1); // Timer still pending

    jest.advanceTimersByTime(1);
    await delayPromise;
    expect(jest.getTimerCount()).toBe(0); // Timer resolved
  });

  it('should resolve immediately for 0ms delay', async () => {
    const delayPromise = delay(0);
    jest.advanceTimersByTime(0);
    await delayPromise;
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('withBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should return result on success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const isRetryable = jest.fn().mockReturnValue({ retryable: false, statusCode: 200 });

    const result = await withBackoff(fn, isRetryable);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockResolvedValueOnce('success');
    const isRetryable = jest.fn().mockReturnValue({ retryable: true, statusCode: 429 });
    const getRetryAfter = jest.fn().mockReturnValue(null);

    const resultPromise = withBackoff(fn, isRetryable, getRetryAfter, { maxRetries: 3 });

    // First call fails, need to advance timers for retry
    await jest.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw on non-retryable error', async () => {
    const error = new Error('Bad request');
    const fn = jest.fn().mockRejectedValue(error);
    const isRetryable = jest.fn().mockReturnValue({ retryable: false, statusCode: 400 });

    await expect(withBackoff(fn, isRetryable)).rejects.toThrow('Bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    const error = new Error('Rate limited');
    const fn = jest.fn().mockRejectedValue(error);
    const isRetryable = jest.fn().mockReturnValue({ retryable: true, statusCode: 429 });
    const getRetryAfter = jest.fn().mockReturnValue(null);

    // Start the promise and track it
    let caughtError: Error | undefined;
    const resultPromise = withBackoff(fn, isRetryable, getRetryAfter, { maxRetries: 2 }).catch(
      (e) => {
        caughtError = e;
      }
    );

    // Advance through all retries: 1000ms + 2000ms = 3000ms total
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toBe('Rate limited');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should use Retry-After header for delay', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockResolvedValueOnce('success');
    const isRetryable = jest.fn().mockReturnValue({ retryable: true, statusCode: 429 });
    const getRetryAfter = jest.fn().mockReturnValue(5); // 5 seconds

    const resultPromise = withBackoff(fn, isRetryable, getRetryAfter, { maxRetries: 3 });

    // Advance by Retry-After value (5 seconds)
    await jest.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('should use exponential backoff when Retry-After is null', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Server error'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce('success');
    const isRetryable = jest.fn().mockReturnValue({ retryable: true, statusCode: 500 });
    const getRetryAfter = jest.fn().mockReturnValue(null);

    const resultPromise = withBackoff(fn, isRetryable, getRetryAfter, { maxRetries: 3 });

    // First retry: 1000ms
    await jest.advanceTimersByTimeAsync(1000);
    // Second retry: 2000ms
    await jest.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
