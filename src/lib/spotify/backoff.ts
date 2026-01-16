/**
 * Exponential backoff utility for Spotify API rate limiting
 * Implements retry logic with exponential delays for 429 and 5xx responses
 */

/**
 * Configuration for exponential backoff
 */
export interface BackoffConfig {
  /** Maximum number of retries before failing (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for backoff calculation (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Jitter factor to add randomness (0-1, default: 0.1) */
  jitterFactor?: number;
}

/**
 * Result of backoff calculation
 */
export interface BackoffResult {
  /** Whether another retry should be attempted */
  shouldRetry: boolean;
  /** Delay in milliseconds before next retry */
  delayMs: number;
  /** Current attempt number (1-indexed) */
  attempt: number;
}

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: Required<BackoffConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
};

/**
 * Calculates the delay for exponential backoff
 * Uses the formula: min(maxDelay, baseDelay * 2^attempt) + jitter
 *
 * @param attempt - Current attempt number (0-indexed, 0 = first retry)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Required<BackoffConfig> = DEFAULT_BACKOFF_CONFIG
): number {
  // Calculate exponential delay: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Cap at maxDelayMs
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random();

  return Math.floor(cappedDelay + jitter);
}

/**
 * Calculates the delay considering Retry-After header from rate limit response
 * Prefers Retry-After value if provided and reasonable, otherwise uses exponential backoff
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param retryAfterSeconds - Retry-After header value in seconds (if available)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateDelayWithRetryAfter(
  attempt: number,
  retryAfterSeconds: number | null,
  config: Required<BackoffConfig> = DEFAULT_BACKOFF_CONFIG
): number {
  // If Retry-After is provided and reasonable, use it
  if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
    const retryAfterMs = retryAfterSeconds * 1000;
    // Cap at maxDelayMs but respect Retry-After if it's within reasonable bounds
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  // Otherwise, use exponential backoff
  return calculateBackoffDelay(attempt, config);
}

/**
 * Determines if a retry should be attempted and calculates the delay
 *
 * @param attempt - Current attempt number (1-indexed, 1 = first attempt)
 * @param statusCode - HTTP status code of the failed request
 * @param retryAfterSeconds - Retry-After header value in seconds (if available)
 * @param config - Backoff configuration
 * @returns BackoffResult with shouldRetry, delayMs, and attempt
 */
export function getBackoffResult(
  attempt: number,
  statusCode: number,
  retryAfterSeconds: number | null = null,
  config: BackoffConfig = {}
): BackoffResult {
  const fullConfig: Required<BackoffConfig> = {
    ...DEFAULT_BACKOFF_CONFIG,
    ...config,
  };

  // Check if we've exceeded max retries
  // attempt is 1-indexed: attempt 1 is the first try, attempt 2 is first retry, etc.
  // So we can retry while attempt <= maxRetries (meaning we have more retries left)
  if (attempt > fullConfig.maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      attempt,
    };
  }

  // Only retry for rate limiting (429) and server errors (5xx)
  const isRetryableStatus = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

  if (!isRetryableStatus) {
    return {
      shouldRetry: false,
      delayMs: 0,
      attempt,
    };
  }

  // Calculate delay (attempt is 1-indexed, so subtract 1 for 0-indexed calculation)
  const delayMs = calculateDelayWithRetryAfter(
    attempt - 1,
    retryAfterSeconds,
    fullConfig
  );

  return {
    shouldRetry: true,
    delayMs,
    attempt,
  };
}

/**
 * Creates a delay promise that resolves after the specified milliseconds
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a function with exponential backoff retry logic
 *
 * @param fn - Async function to execute
 * @param isRetryable - Function to determine if an error should trigger a retry
 * @param getRetryAfter - Function to extract Retry-After from error (optional)
 * @param config - Backoff configuration
 * @returns Result of the function
 * @throws Last error if all retries are exhausted
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => { retryable: boolean; statusCode: number },
  getRetryAfter?: (error: unknown) => number | null,
  config: BackoffConfig = {}
): Promise<T> {
  const fullConfig: Required<BackoffConfig> = {
    ...DEFAULT_BACKOFF_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= fullConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const { retryable, statusCode } = isRetryable(error);
      const retryAfter = getRetryAfter ? getRetryAfter(error) : null;

      const backoffResult = getBackoffResult(attempt, statusCode, retryAfter, fullConfig);

      if (!retryable || !backoffResult.shouldRetry) {
        throw error;
      }

      // Wait before retrying
      await delay(backoffResult.delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
