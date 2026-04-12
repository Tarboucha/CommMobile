import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertBookingParty } from "@/lib/guards/assert-booking-party";
import { mapRpcError } from "@/lib/utils/rpc-errors";

/**
 * GET /api/bookings/:bookingId/conversation
 * Get or create the conversation for a booking.
 * Now that conversations are created atomically with bookings (in the RPC),
 * this endpoint is mostly a lookup. The fallback RPC creation handles
 * legacy bookings created before the atomic conversation feature.
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return handleServiceError(new Error("Booking ID is required"));

  try {
    await assertBookingParty(bookingId, user.id);

    // Look up existing conversation (should always exist for new bookings)
    const existing = await prisma.conversations.findFirst({
      where: { booking_id: bookingId, conversation_type: "booking" },
    });

    if (existing) {
      return successResponse({ conversation: existing });
    }

    // Fallback: create via RPC for legacy bookings without a conversation
    let conversationId: string;
    try {
      const result = await prisma.$queryRaw<[{ create_booking_conversation: string }]>`
        SELECT public.create_booking_conversation(
          ${bookingId}::uuid,
          ${user.id}::uuid
        ) AS create_booking_conversation
      `;
      conversationId = result[0].create_booking_conversation;
    } catch (err) {
      mapRpcError(err);
    }

    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    });

    return successResponse({ conversation }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET"]); }
export async function PUT() { return handleUnsupportedMethod(["GET"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET"]); }
