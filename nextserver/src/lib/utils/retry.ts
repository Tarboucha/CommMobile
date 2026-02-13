/**
 * Retry Logic Utilities
 * Provides retry mechanisms with exponential backoff for handling transient failures
 * in storage and database operations.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 100) */
  delayMs?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Operation name for logging (optional) */
  operationName?: string;
}

export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @returns RetryResult with success status, result, error, and attempt count
 *
 * @example
 * ```ts
 * const result = await retryOperation(
 *   async () => {
 *     const { data, error } = await supabase.from("table").insert(...);
 *     if (error) throw error;
 *     return data;
 *   },
 *   { maxAttempts: 3, delayMs: 100, backoffMultiplier: 2, operationName: "Insert record" }
 * );
 * ```
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    delayMs = 100,
    backoffMultiplier = 2,
    operationName = "Operation",
  } = options;

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const result = await operation();
      
      // Log success if retry was needed
      if (attempt > 1) {
        console.log(
          `[Retry] ${operationName} succeeded on attempt ${attempt}/${maxAttempts}`
        );
      }

      return {
        success: true,
        result,
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log warning for each failed attempt
      if (attempt < maxAttempts) {
        console.warn(
          `[Retry] ${operationName} failed on attempt ${attempt}/${maxAttempts}: ${lastError.message}. Retrying...`
        );
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts exhausted
  console.error(
    `[Retry] ${operationName} failed after ${attempts} attempts: ${lastError?.message}`
  );

  return {
    success: false,
    error: lastError,
    attempts,
  };
}

/**
 * Storage error types for structured logging
 */
export enum StorageErrorType {
  /** File uploaded to storage but database insert failed */
  ORPHANED_FILE = "ORPHANED_FILE",
  /** Cleanup attempt failed after DB insert failure */
  CLEANUP_FAILED = "CLEANUP_FAILED",
  /** Database insert failed after all retries */
  DB_INSERT_FAILED = "DB_INSERT_FAILED",
}

/**
 * Structured error log for storage operations
 */
export interface StorageErrorLog {
  /** Error type */
  type: StorageErrorType;
  /** Storage bucket name */
  bucket: string;
  /** Storage path (relative to bucket) */
  path: string;
  /** Full storage path (bucket/path) */
  storagePath: string;
  /** Resource ID (e.g. profile ID, offering ID) */
  resourceId: string;
  /** Resource type for context */
  resourceType: string;
  /** Timestamp of error */
  timestamp: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Original error message */
  originalError?: string;
}

/**
 * Log structured storage error for monitoring
 *
 * This logs errors in a structured format that can be easily integrated
 * with monitoring systems like Grafana or Sentry.
 *
 * @param errorLog - Structured error information
 *
 * @example
 * ```ts
 * logStorageError({
 *   type: StorageErrorType.ORPHANED_FILE,
 *   bucket: "profile-avatars",
 *   path: "profile-id/avatar.jpg",
 *   storagePath: "profile-avatars/profile-id/avatar.jpg",
 *   resourceId: "profile-id",
 *   resourceType: "profile-avatar",
 *   timestamp: new Date().toISOString(),
 *   retryCount: 3,
 *   originalError: "Database update failed",
 * });
 * ```
 */
export function logStorageError(errorLog: StorageErrorLog): void {
  const logMessage = `STORAGE_ERROR_${errorLog.type}`;
  const logPayload = JSON.stringify(errorLog, null, 2);

  console.error(`[${logMessage}]`, logPayload);

  // TODO: Integrate with monitoring system (Grafana/Sentry)
  // Example:
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(new Error(logMessage), {
  //     extra: errorLog,
  //   });
  // }
}

