import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { bookingStatusUpdateSchema } from "@/lib/validations/booking";

// ============================================================================
// Allowed status transitions
// ============================================================================

type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled"
  | "loaned_out"
  | "returned";

const PROVIDER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "loaned_out", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["completed"],
  loaned_out: [],
  returned: ["completed"],
};

const CUSTOMER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["cancelled"],
};

// ============================================================================
// GET /api/bookings/:bookingId
// ============================================================================

export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const { bookingId } = params!;

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return ApiErrors.notFound("Booking");
  }

  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  try {
    const [bookingItems, customerSnapshot, deliverySnapshot, communitySnapshot, statusHistory] =
      await Promise.all([
        prisma.booking_items.findMany({
          where: { booking_id: bookingId },
          include: {
            booking_provider_snapshots: true,
            booking_schedule_snapshots: true,
          },
          orderBy: { created_at: "asc" },
        }),
        prisma.booking_customer_snapshots.findFirst({
          where: { booking_id: bookingId },
        }),
        prisma.booking_delivery_snapshots.findFirst({
          where: { booking_id: bookingId },
          include: { snapshot_addresses: true },
        }),
        prisma.booking_community_snapshots.findFirst({
          where: { booking_id: bookingId },
        }),
        prisma.booking_status_history.findMany({
          where: { booking_id: bookingId },
          orderBy: { created_at: "asc" },
        }),
      ]);

    return successResponse({
      booking: {
        ...booking,
        booking_items: bookingItems,
        customer_snapshot: customerSnapshot || null,
        delivery_snapshot: deliverySnapshot || null,
        community_snapshot: communitySnapshot || null,
        status_history: statusHistory,
      } as any,
    });
  } catch (error) {
    console.error("Error fetching booking details:", error);
    return ApiErrors.serverError();
  }
});

// ============================================================================
// PATCH /api/bookings/:bookingId
// ============================================================================

export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const { bookingId } = params!;

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

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: { id: true, customer_id: true, provider_id: true, booking_status: true },
  });

  if (!booking) {
    return ApiErrors.notFound("Booking");
  }

  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

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

  const updateData: Record<string, unknown> = {
    booking_status: newStatus,
  };

  switch (newStatus) {
    case "confirmed":
      updateData.confirmed_at = new Date();
      break;
    case "ready":
      updateData.ready_at = new Date();
      break;
    case "completed":
      updateData.completed_at = new Date();
      break;
    case "cancelled":
      updateData.cancelled_at = new Date();
      updateData.cancelled_by_id = user.id;
      if (cancellation_reason) {
        updateData.cancellation_reason = cancellation_reason;
      }
      break;
    case "loaned_out":
      updateData.updated_at = new Date();
      break;
  }

  try {
    const updatedBooking = await prisma.bookings.update({
      where: { id: bookingId },
      data: updateData as any,
    });

    return successResponse({ booking: updatedBooking as any });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return ApiErrors.serverError("Failed to update booking status");
  }
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
