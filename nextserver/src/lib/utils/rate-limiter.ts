/**
 * Rate Limiter Utility
 * Prevents abuse by limiting requests per identifier (IP address or email)
 * 
 * Uses in-memory storage with automatic cleanup of expired entries
 * Supports multiple rate limiters with different configurations
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window (default: 5) */
  maxRequests?: number;
  /** Time window in milliseconds (default: 15 minutes) */
  windowMs?: number;
}

/**
 * Internal rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when the window resets
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default rate limit configuration
 * 5 requests per 15 minutes per identifier
 */
const DEFAULT_RATE_LIMIT: Required<RateLimitConfig> = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
};

// ============================================================================
// Predefined Rate Limit Configurations
// ============================================================================

/**
 * Common rate limit configurations for different use cases
 * Use these as starting points for your endpoints
 */
export const RateLimitPresets = {
  /** Strict: 3 requests per 5 minutes (e.g., login attempts, password reset) */
  strict: {
    maxRequests: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  /** Moderate: 5 requests per 15 minutes (e.g., contact forms, sign-ups) */
  moderate: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  /** Relaxed: 10 requests per 15 minutes (e.g., API endpoints with auth) */
  relaxed: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  /** Very Relaxed: 20 requests per minute (e.g., read-only endpoints) */
  veryRelaxed: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Cleanup interval - remove expired entries every 5 minutes
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Rate Limiter Class
// ============================================================================

/**
 * Rate limiter instance
 * Tracks requests per identifier with configurable limits
 */
class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly name: string;

  constructor(config: RateLimitConfig = {}, name: string = "default") {
    this.maxRequests = config.maxRequests ?? DEFAULT_RATE_LIMIT.maxRequests;
    this.windowMs = config.windowMs ?? DEFAULT_RATE_LIMIT.windowMs;
    this.name = name;
    this.startCleanup();
  }

  /**
   * Check if identifier has exceeded rate limit
   * @param identifier - IP address, email, or other unique identifier
   * @returns true if within rate limit, false if exceeded
   */
  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    // No entry or expired window - allow request
    if (!entry || now >= entry.resetAt) {
      return true;
    }

    // Check if limit exceeded
    return entry.count < this.maxRequests;
  }

  /**
   * Record a request for the identifier
   * @param identifier - IP address, email, or other unique identifier
   */
  recordRequest(identifier: string): void {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    if (!entry || now >= entry.resetAt) {
      // Create new entry or reset expired entry
      this.entries.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
    } else {
      // Increment existing entry
      entry.count += 1;
    }
  }

  /**
   * Get remaining requests for identifier
   * @param identifier - IP address, email, or other unique identifier
   * @returns number of remaining requests, or maxRequests if no entry
   */
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    if (!entry || now >= entry.resetAt) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   * @param identifier - IP address, email, or other unique identifier
   * @returns milliseconds until reset, or 0 if no entry or expired
   */
  getResetTime(identifier: string): number {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    if (!entry || now >= entry.resetAt) {
      return 0;
    }

    return entry.resetAt - now;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Only start cleanup in Node.js environment (server-side)
    if (typeof setInterval === "undefined") {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [identifier, entry] of this.entries.entries()) {
      if (now >= entry.resetAt) {
        this.entries.delete(identifier);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(
        `[Rate Limiter: ${this.name}] Cleaned up ${removedCount} expired entries. Remaining: ${this.entries.size}`
      );
    }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Stop cleanup interval (useful for testing or shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RateLimitConfig> {
    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    };
  }
}

// ============================================================================
// Rate Limiter Registry
// ============================================================================

/**
 * Registry of rate limiter instances
 * Stores named rate limiters with their configurations
 */
const rateLimiterRegistry = new Map<string, RateLimiter>();

/**
 * Create a new rate limiter instance with the given configuration
 * 
 * @param config - Rate limit configuration options
 * @param name - Optional name for the rate limiter (default: "default")
 * @returns Rate limiter instance
 * 
 * @example
 * ```ts
 * // Create a rate limiter for contact inquiries: 5 requests per 15 minutes
 * const contactLimiter = createRateLimiter(
 *   { maxRequests: 5, windowMs: 15 * 60 * 1000 },
 *   "contact-inquiries"
 * );
 * 
 * // Create a rate limiter for login attempts: 3 requests per 5 minutes
 * const loginLimiter = createRateLimiter(
 *   { maxRequests: 3, windowMs: 5 * 60 * 1000 },
 *   "login"
 * );
 * ```
 */
export function createRateLimiter(
  config: RateLimitConfig = {},
  name: string = "default"
): RateLimiter {
  // If instance already exists, return it
  if (rateLimiterRegistry.has(name)) {
    const existing = rateLimiterRegistry.get(name)!;
    // Verify configuration matches (optional - could throw error if different)
    return existing;
  }

  // Create new instance
  const limiter = new RateLimiter(config, name);
  rateLimiterRegistry.set(name, limiter);
  return limiter;
}

/**
 * Get or create a rate limiter instance by name
 * If the instance doesn't exist, creates it with the provided config
 * 
 * @param name - Name of the rate limiter (e.g., "contact-inquiries", "login", "api")
 * @param config - Rate limit configuration (used only if instance doesn't exist)
 * @returns Rate limiter instance
 * 
 * @example
 * ```ts
 * // Example 1: Contact form - moderate rate limiting
 * const limiter = getRateLimiter("contact-inquiries", RateLimitPresets.moderate);
 * if (!limiter.checkRateLimit(ip)) {
 *   return ApiErrors.tooManyRequests("Too many requests");
 * }
 * limiter.recordRequest(ip);
 * 
 * // Example 2: Login endpoint - strict rate limiting
 * const loginLimiter = getRateLimiter("login", RateLimitPresets.strict);
 * if (!loginLimiter.checkRateLimit(email)) {
 *   return ApiErrors.tooManyRequests("Too many login attempts");
 * }
 * loginLimiter.recordRequest(email);
 * 
 * // Example 3: Custom configuration
 * const customLimiter = getRateLimiter("custom-endpoint", {
 *   maxRequests: 10,
 *   windowMs: 60 * 1000, // 1 minute
 * });
 * ```
 */
export function getRateLimiter(
  name: string,
  config?: RateLimitConfig
): RateLimiter {
  if (rateLimiterRegistry.has(name)) {
    return rateLimiterRegistry.get(name)!;
  }

  // Create new instance if it doesn't exist
  return createRateLimiter(config ?? {}, name);
}

