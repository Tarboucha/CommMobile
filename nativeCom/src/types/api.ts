/**
 * API and Retry Types
 */

/**
 * Custom error class for API errors
 * Includes HTTP status code for retry logic decisions
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface FetchAPIOptions extends RequestInit {
  /**
   * Retry configuration
   * - true: use default retry settings
   * - false: disable retry
   * - RetryOptions: custom retry settings
   */
  retry?: boolean | RetryOptions;
}
