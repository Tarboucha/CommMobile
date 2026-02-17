import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/bookings/:bookingId/conversation
 * Get or create the conversation for a booking.
 * Only accessible by the booking customer or the provider.
 * Uses SECURITY DEFINER RPC to bypass RLS chicken-and-egg problem.
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const { bookingId } = params!;
  const supabase = await createClient();

  // 1. Fetch booking (provider_id is directly on the booking)
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, customer_id, provider_id")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return ApiErrors.notFound("Booking");
  }

  // 2. Access check: customer or provider
  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;

  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  // 3. Look up existing conversation
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("conversation_type", "booking")
    .maybeSingle();

  if (existing) {
    return successResponse({ conversation: existing });
  }

  // 4. Create via SECURITY DEFINER RPC (atomically creates conversation + participants)
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

  // 5. Fetch the full conversation (now visible since participants exist)
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    console.error("Failed to fetch newly created booking conversation");
    return ApiErrors.serverError();
  }

  return successResponse({ conversation }, undefined, 201);
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
