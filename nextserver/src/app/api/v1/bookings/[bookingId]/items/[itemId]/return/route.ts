import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as bookingService from "@/lib/services/booking-service";

/**
 * POST /api/bookings/[bookingId]/items/[itemId]/return
 * Marks a loan booking item as returned. Provider only.
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  const itemId = params?.itemId;
  if (!bookingId || !itemId) {
    return handleServiceError(new Error("Booking ID and Item ID are required"));
  }

  try {
    const detail = await bookingService.returnLoanItem(bookingId, itemId, user.id);
    return successResponse({ booking: detail });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
