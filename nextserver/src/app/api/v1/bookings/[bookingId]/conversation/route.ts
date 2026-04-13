import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as conversationService from "@/lib/services/conversation-service";

/**
 * GET /api/bookings/:bookingId/conversation
 * Get or create the conversation for a booking.
 */
export const GET = withAuth(async (user, _request, params) => {
  try {
    const { conversation, created } =
      await conversationService.getOrCreateBookingConversation(
        params!.bookingId,
        user.id
      );
    return successResponse({ conversation }, undefined, created ? 201 : 200);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET"]); }
export async function PUT() { return handleUnsupportedMethod(["GET"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET"]); }
