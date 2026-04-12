import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/bookings/:bookingId/conversation
 * Get or create the conversation for a booking.
 * Only accessible by the booking customer or the provider.
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const { bookingId } = params!;

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: { id: true, customer_id: true, provider_id: true },
  });

  if (!booking) {
    return ApiErrors.notFound("Booking");
  }

  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  // Look up existing conversation
  const existing = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
  });

  if (existing) {
    return successResponse({ conversation: existing as any });
  }

  try {
    // Create via SECURITY DEFINER RPC (atomically creates conversation + participants)
    const supabase = await createClient();
    const { data: conversationId, error: rpcError } = await supabase.rpc(
      "create_booking_conversation",
      {
        p_booking_id: bookingId,
        p_creator_profile_id: user.id,
      }
    );

    if (rpcError || !conversationId) {
      console.error("Failed to create booking conversation:", rpcError);
      return ApiErrors.serverError();
    }

    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      console.error("Failed to fetch newly created booking conversation");
      return ApiErrors.serverError();
    }

    return successResponse({ conversation: conversation as any }, undefined, 201);
  } catch (error) {
    console.error("Error creating booking conversation:", error);
    return ApiErrors.serverError();
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
