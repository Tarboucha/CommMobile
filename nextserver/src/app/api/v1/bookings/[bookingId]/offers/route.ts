import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as offerService from "@/lib/services/offer-service";

const offerActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("counter"),
    offered_amount: z.number().positive(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("accept"),
    offer_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("decline"),
    offer_id: z.string().uuid(),
  }),
]);

/**
 * POST /api/bookings/:bookingId/offers
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return handleServiceError(new Error("Booking ID is required"));

  try {
    const input = await parseJsonBody(request, offerActionSchema);

    if (input.action === "counter") {
      const result = await offerService.counterOffer(
        bookingId, user.id, input.offered_amount, input.note
      );
      return successResponse(result, undefined, 201);
    }

    if (input.action === "accept") {
      const result = await offerService.acceptOffer(bookingId, user.id, input.offer_id);
      return successResponse(result);
    }

    if (input.action === "decline") {
      const result = await offerService.declineOffer(bookingId, user.id, input.offer_id);
      return successResponse(result);
    }

    return handleServiceError(new Error("Invalid action"));
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * GET /api/bookings/:bookingId/offers
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return handleServiceError(new Error("Booking ID is required"));

  try {
    const offers = await offerService.listOffers(bookingId, user.id);
    return successResponse({ offers });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
