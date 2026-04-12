import {
  InsufficientSlotsError,
  VersionMismatchError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  BookingNotAllowedError,
  OfferingUnavailableError,
  ValidationError,
} from "@/lib/errors/domain-errors";
import { getRequestId } from "@/lib/request-context";

/**
 * Maps RPC (PostgreSQL function) error messages to domain errors.
 * The RPC layer uses RAISE EXCEPTION with descriptive messages.
 * This function parses those messages into typed, catchable errors.
 *
 * Covers all SECURITY DEFINER RPCs:
 *   - create_booking_with_items (slot reservation, version checks, self-booking)
 *   - return_loan_item (loan validation, already returned)
 *   - create_booking_conversation (booking not found, not a party)
 *   - create_direct_conversation (not authenticated, no shared community)
 *   - join_community_via_invite_link (returned as JSON, not RAISE)
 */
export function mapRpcError(error: unknown): never {
  const msg = (error as Error)?.message ?? "";

  // ─── Booking creation (create_booking_with_items) ─────────────────────
  if (msg.includes("Not enough slots")) {
    throw new InsufficientSlotsError(
      "One or more items are fully booked for the selected date. Please update your selection."
    );
  }
  if (msg.includes("version mismatch")) {
    throw new VersionMismatchError();
  }
  if (msg.includes("cancelled")) {
    throw new OfferingUnavailableError(
      "One or more items are no longer available for the selected date."
    );
  }
  if (msg.includes("not found or inactive")) {
    throw new OfferingUnavailableError(
      "One or more schedules are no longer available."
    );
  }
  if (msg.includes("Cannot book your own offering")) {
    throw new BookingNotAllowedError("You cannot book your own offering");
  }

  // ─── Loan return (return_loan_item) ───────────────────────────────────
  if (msg.includes("already been returned")) {
    throw new ConflictError("This item has already been returned");
  }
  if (msg.includes("not a loan")) {
    throw new ValidationError("This item is not a loan");
  }
  if (msg.includes("missing loan dates")) {
    throw new ValidationError("Loan item is missing loan dates");
  }
  if (msg.includes("has no schedule to release")) {
    throw new ValidationError("Loan item has no schedule to release slots on");
  }

  // ─── Booking conversation (create_booking_conversation) ───────────────
  if (msg.includes("Booking not found")) {
    throw new NotFoundError("Booking");
  }
  if (msg.includes("Not a party to this booking")) {
    throw new ForbiddenError("You are not a party to this booking");
  }

  // ─── Direct conversation (create_direct_conversation) ─────────────────
  if (msg.includes("Not authenticated")) {
    throw new ForbiddenError("Authentication required");
  }
  if (msg.includes("must share a common community")) {
    throw new ForbiddenError("You must share a community with this user to message them");
  }

  // ─── Generic not-found patterns ───────────────────────────────────────
  if (msg.includes("not found")) {
    throw new NotFoundError("Resource");
  }

  // Unknown RPC error — log with request ID and re-throw
  console.error(`[${getRequestId()}] unknown RPC error:`, msg);
  throw error;
}
