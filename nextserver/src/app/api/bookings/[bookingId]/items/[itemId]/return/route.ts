import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bookings/[bookingId]/items/[itemId]/return
 *
 * Marks a loan booking item as returned. Only the provider can trigger this.
 * Calls the `return_loan_item` RPC which:
 *   - releases reserved slots across the loan period
 *   - sets `loan_returned_at` on the item
 *   - updates the booking status to `returned` when all loan items are back
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  const itemId = params?.itemId;

  if (!bookingId || !itemId) {
    return ApiErrors.badRequest("Booking ID and Item ID are required");
  }

  const item = await prisma.booking_items.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      booking_id: true,
      is_loan: true,
      loan_returned_at: true,
      bookings: { select: { provider_id: true } },
    },
  });

  if (!item || item.booking_id !== bookingId) {
    return ApiErrors.notFound("Booking item");
  }

  if (item.bookings.provider_id !== user.id) {
    return ApiErrors.forbidden("Only the provider can mark an item as returned");
  }

  if (!item.is_loan) {
    return ApiErrors.badRequest("This item is not a loan");
  }

  if (item.loan_returned_at) {
    return ApiErrors.badRequest("This item has already been returned");
  }

  try {
    await prisma.$executeRaw`SELECT public.return_loan_item(${itemId}::uuid)`;
  } catch (error) {
    console.error("Error returning loan item:", error);
    return ApiErrors.serverError("Failed to mark item as returned");
  }

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return ApiErrors.notFound("Booking");
  }

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
      prisma.booking_customer_snapshots.findFirst({ where: { booking_id: bookingId } }),
      prisma.booking_delivery_snapshots.findFirst({
        where: { booking_id: bookingId },
        include: { snapshot_addresses: true },
      }),
      prisma.booking_community_snapshots.findFirst({ where: { booking_id: bookingId } }),
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
});

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
