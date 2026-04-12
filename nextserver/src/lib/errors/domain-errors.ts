/**
 * Domain errors thrown by the service layer.
 * Route handlers catch these and map them to HTTP responses via handleServiceError().
 *
 * Never throw ApiErrors or return NextResponse from services — services
 * are transport-agnostic (callable from HTTP routes, WebSockets, cron jobs, tests).
 */

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ─── 404 ────────────────────────────────────────────────────────────────────

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`);
  }
}

// ─── 403 ────────────────────────────────────────────────────────────────────

export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message);
  }
}

export class NotCommunityMemberError extends DomainError {
  constructor() {
    super("NOT_COMMUNITY_MEMBER", "You are not an active member of this community");
  }
}

// ─── 400 ────────────────────────────────────────────────────────────────────

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string, role: string) {
    super(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from "${from}" to "${to}" as ${role}`
    );
  }
}

// ─── 409 ────────────────────────────────────────────────────────────────────

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class VersionMismatchError extends DomainError {
  constructor(offeringTitle?: string) {
    super(
      "VERSION_MISMATCH",
      offeringTitle
        ? `"${offeringTitle}" has been updated. Please refresh and try again.`
        : "Resource has been updated. Please refresh and try again."
    );
  }
}

export class IdempotencyHitError extends DomainError {
  /** Carry the existing resource so the handler can return it */
  constructor(
    public readonly existingData: unknown
  ) {
    super("IDEMPOTENCY_HIT", "Duplicate request detected");
  }
}

// ─── 422 (business rule violations) ─────────────────────────────────────────

export class InsufficientSlotsError extends DomainError {
  constructor(message = "Not enough slots available for the selected date") {
    super("SLOTS_UNAVAILABLE", message);
  }
}

export class BookingNotAllowedError extends DomainError {
  constructor(message = "This booking is not allowed") {
    super("BOOKING_NOT_ALLOWED", message);
  }
}

export class OfferingUnavailableError extends DomainError {
  constructor(message = "This offering is no longer available") {
    super("OFFERING_UNAVAILABLE", message);
  }
}

export class OfferNotPendingError extends DomainError {
  constructor() {
    super("OFFER_NOT_PENDING", "This offer is no longer pending");
  }
}

export class SelfActionError extends DomainError {
  constructor(message = "You cannot perform this action on your own resource") {
    super("SELF_ACTION", message);
  }
}
