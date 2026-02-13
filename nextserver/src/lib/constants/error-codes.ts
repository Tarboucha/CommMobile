/**
 * API Error Codes
 * Centralized error codes for consistent API responses
 * Grouped by HTTP status semantics
 */

export const ERROR_CODES = {
  // ============================================
  // 400 Bad Request - Invalid input
  // ============================================
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // ============================================
  // 401 Unauthorized - Authentication issues
  // ============================================
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_CONFIRMED: "AUTH_EMAIL_NOT_CONFIRMED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",

  // ============================================
  // 403 Forbidden - Authorization issues
  // ============================================
  FORBIDDEN: "FORBIDDEN",
  NOT_COMMUNITY_MEMBER: "NOT_COMMUNITY_MEMBER",
  NOT_COMMUNITY_ADMIN: "NOT_COMMUNITY_ADMIN",
  NOT_RESOURCE_OWNER: "NOT_RESOURCE_OWNER",
  NOT_CONVERSATION_PARTICIPANT: "NOT_CONVERSATION_PARTICIPANT",

  // ============================================
  // 404 Not Found
  // ============================================
  NOT_FOUND: "NOT_FOUND",

  // ============================================
  // 405 Method Not Allowed
  // ============================================
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",

  // ============================================
  // 409 Conflict - State conflicts
  // ============================================
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // ============================================
  // 422 Unprocessable - Business logic errors
  // ============================================
  SLOTS_UNAVAILABLE: "SLOTS_UNAVAILABLE",
  BOOKING_NOT_ALLOWED: "BOOKING_NOT_ALLOWED",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  OFFERING_UNAVAILABLE: "OFFERING_UNAVAILABLE",

  // ============================================
  // 429 Too Many Requests
  // ============================================
  RATE_LIMITED: "RATE_LIMITED",

  // ============================================
  // 500 Internal Server Error
  // ============================================
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
