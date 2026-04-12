import { NextRequest } from "next/server";
import { withAuth, withSecureAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { bookingCreateSchema } from "@/lib/validations/booking";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as bookingService from "@/lib/services/booking-service";

/**
 * POST /api/bookings
 * Create a new booking with atomic slot reservation.
 */
export const POST = withSecureAuth(async (user, request: NextRequest) => {
  try {
    const input = await parseJsonBody(request, bookingCreateSchema);
    const result = await bookingService.createBooking(user, input);
    return successResponse({ booking: result }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * GET /api/bookings
 * List bookings for the current user (as customer and/or provider).
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  try {
    const role = new URL(request.url).searchParams.get("role") ?? undefined;
    const bookings = await bookingService.listBookings(user.id, role);
    return successResponse({ bookings });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
