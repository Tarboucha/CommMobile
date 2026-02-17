import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { bookingStatusUpdateSchema } from "@/lib/validations/booking";

// ============================================================================
// Allowed status transitions
// ============================================================================

type BookingStatus = "pending" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";

const PROVIDER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["completed"],
};

const CUSTOMER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["cancelled"],
};

// ============================================================================
// GET /api/bookings/:bookingId
// ============================================================================

/**
 * Fetch a booking with items, snapshots, and status history.
 * Accessible by the booking customer or the provider.
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const { bookingId } = params!;
  const supabase = await createClient();

  // Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return ApiErrors.notFound("Booking");
  }

  // Access check: customer or provider (direct column check)
  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  // Fetch items with provider + schedule snapshots
  const { data: bookingItems } = await supabase
    .from("booking_items")
    .select(`
      *,
      booking_provider_snapshots (*),
      booking_schedule_snapshots (*)
    `)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  // Fetch booking-level snapshots
  const { data: customerSnapshot } = await supabase
    .from("booking_customer_snapshots")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  const { data: deliverySnapshot } = await supabase
    .from("booking_delivery_snapshots")
    .select("*, snapshot_addresses(*)")
    .eq("booking_id", bookingId)
    .maybeSingle();

  const { data: communitySnapshot } = await supabase
    .from("booking_community_snapshots")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  // Fetch status history
  const { data: statusHistory } = await supabase
    .from("booking_status_history")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  return successResponse({
    booking: {
      ...booking,
      booking_items: bookingItems || [],
      customer_snapshot: customerSnapshot || null,
      delivery_snapshot: deliverySnapshot || null,
      community_snapshot: communitySnapshot || null,
      status_history: statusHistory || [],
    },
  });
});

// ============================================================================
// PATCH /api/bookings/:bookingId
// ============================================================================

/**
 * Update booking status.
 * Provider: can accept, advance, refuse, or cancel.
 * Customer: can cancel (pending/confirmed only).
 * DB trigger handles notifications + status history automatically.
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const { bookingId } = params!;
  const supabase = await createClient();

  // Parse body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = bookingStatusUpdateSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { booking_status: newStatus, cancellation_reason } = validation.data;

  // Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, customer_id, provider_id, booking_status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return ApiErrors.notFound("Booking");
  }

  // Determine role
  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  // Validate transition
  const currentStatus = booking.booking_status as string;
  const allowedTransitions = isProvider
    ? PROVIDER_TRANSITIONS[currentStatus]
    : CUSTOMER_TRANSITIONS[currentStatus];

  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    const role = isProvider ? "provider" : "customer";
    return ApiErrors.invalidStatusTransition(
      `Cannot transition from "${currentStatus}" to "${newStatus}" as ${role}`
    );
  }

  // Build update payload
  const updateData: Record<string, unknown> = {
    booking_status: newStatus,
  };

  // Set timestamps based on new status
  switch (newStatus) {
    case "confirmed":
      updateData.confirmed_at = new Date().toISOString();
      break;
    case "ready":
      updateData.ready_at = new Date().toISOString();
      break;
    case "completed":
      updateData.completed_at = new Date().toISOString();
      break;
    case "cancelled":
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by_id = user.id;
      if (cancellation_reason) {
        updateData.cancellation_reason = cancellation_reason;
      }
      break;
  }

  // Update booking — DB trigger handles notifications + status history
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .select("*")
    .single();

  if (updateError || !updatedBooking) {
    console.error("Error updating booking status:", updateError);
    return ApiErrors.serverError("Failed to update booking status");
  }

  return successResponse({ booking: updatedBooking });
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}
