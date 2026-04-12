import { ApiErrors } from "@/lib/utils/api-response";
import { getRequestId } from "@/lib/request-context";
import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  NotCommunityMemberError,
  ValidationError,
  ConflictError,
  VersionMismatchError,
  IdempotencyHitError,
  InsufficientSlotsError,
  BookingNotAllowedError,
  OfferingUnavailableError,
  InvalidStatusTransitionError,
  OfferNotPendingError,
  SelfActionError,
} from "./domain-errors";
import { successResponse } from "@/lib/utils/api-response";

/**
 * Maps domain errors thrown by the service layer to HTTP responses.
 * Used in route handlers:
 *
 *   try {
 *     const result = await someService.doSomething(user, input);
 *     return successResponse({ data: result });
 *   } catch (err) {
 *     return handleServiceError(err);
 *   }
 */
export function handleServiceError(err: unknown) {
  // Idempotency hit — return the existing resource (200, not error)
  if (err instanceof IdempotencyHitError) {
    return successResponse(err.existingData);
  }

  // Domain errors → mapped HTTP responses
  if (err instanceof NotFoundError) return ApiErrors.notFound(err.message);
  if (err instanceof NotCommunityMemberError) return ApiErrors.notCommunityMember(err.message);
  if (err instanceof ForbiddenError) return ApiErrors.forbidden(err.message);
  if (err instanceof ValidationError) return ApiErrors.badRequest(err.message);
  if (err instanceof InvalidStatusTransitionError) return ApiErrors.invalidStatusTransition(err.message);
  if (err instanceof VersionMismatchError) return ApiErrors.conflict(err.message);
  if (err instanceof ConflictError) return ApiErrors.conflict(err.message);
  if (err instanceof InsufficientSlotsError) return ApiErrors.slotsUnavailable(err.message);
  if (err instanceof BookingNotAllowedError) return ApiErrors.bookingNotAllowed(err.message);
  if (err instanceof OfferingUnavailableError) return ApiErrors.offeringUnavailable(err.message);
  if (err instanceof OfferNotPendingError) return ApiErrors.badRequest(err.message);
  if (err instanceof SelfActionError) return ApiErrors.badRequest(err.message);

  // Catch-all for unknown DomainErrors
  if (err instanceof DomainError) return ApiErrors.badRequest(err.message);

  // Unknown errors — log with request ID and return 500
  console.error(`[${getRequestId()}] unhandled service error:`, err);
  return ApiErrors.serverError();
}
