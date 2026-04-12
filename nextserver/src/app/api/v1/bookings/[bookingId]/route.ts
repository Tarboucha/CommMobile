import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { bookingStatusUpdateSchema } from "@/lib/validations/booking";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as bookingService from "@/lib/services/booking-service";

/**
 * GET /api/bookings/:bookingId
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return successResponse(null); // withAuth handles missing params

  try {
    const detail = await bookingService.getBookingDetail(bookingId, user.id);
    return successResponse({ booking: detail });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * PATCH /api/bookings/:bookingId
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return successResponse(null);

  try {
    const input = await parseJsonBody(request, bookingStatusUpdateSchema);
    const updated = await bookingService.updateBookingStatus(
      bookingId, user.id, input.booking_status, input.cancellation_reason
    );
    return successResponse({ booking: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET", "PATCH"]); }
export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "PATCH"]); }
