import { NextResponse } from "next/server";
import { ERROR_CODES, HTTP_STATUS } from "@/lib/constants/error-codes";

// Re-export for convenience
export { ERROR_CODES, HTTP_STATUS };

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string, status: number = HTTP_STATUS.OK) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

/**
 * Common error responses
 */
export const ApiErrors = {
  // ============================================
  // 400 Bad Request
  // ============================================
  validationError: (message: string, details?: Record<string, unknown>) =>
    errorResponse(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, details),

  badRequest: (message: string = "Bad request") =>
    errorResponse(message, ERROR_CODES.INVALID_INPUT, HTTP_STATUS.BAD_REQUEST),

  // ============================================
  // 401 Unauthorized
  // ============================================
  unauthorized: (message: string = "Authentication required") =>
    errorResponse(message, ERROR_CODES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED),

  invalidToken: (message: string = "Invalid or expired token") =>
    errorResponse(message, ERROR_CODES.AUTH_INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED),

  invalidCredentials: (message: string = "Invalid email or password") =>
    errorResponse(message, ERROR_CODES.AUTH_INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED),

  emailNotConfirmed: (message: string = "Please confirm your email address before logging in") =>
    errorResponse(message, ERROR_CODES.AUTH_EMAIL_NOT_CONFIRMED, HTTP_STATUS.UNAUTHORIZED),

  sessionExpired: (message: string = "Session expired, please log in again") =>
    errorResponse(message, ERROR_CODES.AUTH_SESSION_EXPIRED, HTTP_STATUS.UNAUTHORIZED),

  // ============================================
  // 403 Forbidden
  // ============================================
  forbidden: (message: string = "Access denied") =>
    errorResponse(message, ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN),

  notCommunityMember: (message: string = "Community membership required") =>
    errorResponse(message, ERROR_CODES.NOT_COMMUNITY_MEMBER, HTTP_STATUS.FORBIDDEN),

  notCommunityAdmin: (message: string = "Community admin access required") =>
    errorResponse(message, ERROR_CODES.NOT_COMMUNITY_ADMIN, HTTP_STATUS.FORBIDDEN),

  notResourceOwner: (message: string = "You don't have permission to access this resource") =>
    errorResponse(message, ERROR_CODES.NOT_RESOURCE_OWNER, HTTP_STATUS.FORBIDDEN),

  notConversationParticipant: (message: string = "You are not a participant in this conversation") =>
    errorResponse(message, ERROR_CODES.NOT_CONVERSATION_PARTICIPANT, HTTP_STATUS.FORBIDDEN),

  // ============================================
  // 404 Not Found
  // ============================================
  notFound: (resource: string = "Resource") =>
    errorResponse(`${resource} not found`, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND),

  // ============================================
  // 405 Method Not Allowed
  // ============================================
  methodNotAllowed: (message: string = "Method not allowed") =>
    errorResponse(message, ERROR_CODES.METHOD_NOT_ALLOWED, HTTP_STATUS.METHOD_NOT_ALLOWED),

  // ============================================
  // 409 Conflict
  // ============================================
  alreadyExists: (message: string = "Resource already exists") =>
    errorResponse(message, ERROR_CODES.ALREADY_EXISTS, HTTP_STATUS.CONFLICT),

  conflict: (message: string) =>
    errorResponse(message, ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT),

  // ============================================
  // 422 Unprocessable Entity - Business logic errors
  // ============================================
  slotsUnavailable: (message: string = "No slots available") =>
    errorResponse(message, ERROR_CODES.SLOTS_UNAVAILABLE, HTTP_STATUS.UNPROCESSABLE_ENTITY),

  bookingNotAllowed: (message: string = "Booking not allowed") =>
    errorResponse(message, ERROR_CODES.BOOKING_NOT_ALLOWED, HTTP_STATUS.UNPROCESSABLE_ENTITY),

  invalidStatusTransition: (message: string = "Invalid status transition") =>
    errorResponse(message, ERROR_CODES.INVALID_STATUS_TRANSITION, HTTP_STATUS.UNPROCESSABLE_ENTITY),

  offeringUnavailable: (message: string = "Offering is not available") =>
    errorResponse(message, ERROR_CODES.OFFERING_UNAVAILABLE, HTTP_STATUS.UNPROCESSABLE_ENTITY),

  unprocessableEntity: (message: string, details?: Record<string, unknown>) =>
    errorResponse(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY, details),

  // ============================================
  // 429 Too Many Requests
  // ============================================
  rateLimited: (message: string = "Too many requests. Please try again later.") =>
    errorResponse(message, ERROR_CODES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS),

  // ============================================
  // 500 Internal Server Error
  // ============================================
  serverError: (message: string = "Internal server error") =>
    errorResponse(message, ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR),
};

/**
 * Parse Zod validation errors into readable string
 */
export function parseZodError(error: any): string {
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ");
  }
  return "Validation error";
}

/**
 * Handle unsupported HTTP methods
 */
export function handleUnsupportedMethod(allowedMethods?: string[]): NextResponse {
  const message = allowedMethods
    ? `Method not allowed. Allowed methods: ${allowedMethods.join(", ")}`
    : "Method not allowed";

  return ApiErrors.methodNotAllowed(message);
}
