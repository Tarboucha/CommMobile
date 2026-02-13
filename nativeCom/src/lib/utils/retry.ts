/**
 * Retry utility with exponential backoff
 */

import { type RetryOptions, ApiClientError } from '@/types/api';

/**
 * Default retry predicate
 * Returns true for errors that are worth retrying
 */
const defaultShouldRetry = (error: unknown): boolean => {
  // Don't retry client errors (4xx) except 408 (timeout) and 429 (rate limit)
  if (error instanceof ApiClientError) {
    const status = error.status;
    // Don't retry 4xx errors (except timeout and rate limit)
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false;
    }
    // Don't retry 401 - handled separately by token refresh
    if (status === 401) {
      return false;
    }
  }
  // Retry network errors, 5xx, timeout (408), rate limit (429)
  return true;
};

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff and jitter
 * Formula: min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
 */
const calculateDelay = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number => {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 100; // 0-100ms random jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
};

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * ```ts
 * // Default retry (3 attempts)
 * const data = await withRetry(() => fetchAPI('/api/data'));
 *
 * // Custom retry config
 * const data = await withRetry(
 *   () => fetchAPI('/api/data'),
 *   { maxRetries: 5, baseDelayMs: 500 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate and wait for backoff delay
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);

      if (__DEV__) {
        console.log(
          `[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`
        );
      }

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
