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
 * Only accessible by the booking customer or the offering provider(s).
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const { bookingId } = params!;
  const supabase = await createClient();

  // 1. Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, customer_id")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return ApiErrors.notFound("Booking");
  }

  // 2. Determine if user is customer or provider
  const isCustomer = booking.customer_id === user.id;

  // Get distinct provider IDs from booking items
  const { data: bookingItems } = await supabase
    .from("booking_items")
    .select("offering_id, offerings!offering_id(provider_id)")
    .eq("booking_id", bookingId);

  const providerIds = [
    ...new Set(
      (bookingItems || [])
        .map((bi: any) => bi.offerings?.provider_id)
        .filter(Boolean) as string[]
    ),
  ];

  const isProvider = providerIds.includes(user.id);

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

  // 4. Create conversation + participants
  const { data: conversation, error: createError } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "booking" as const,
      booking_id: bookingId,
      created_by_profile_id: user.id,
    })
    .select("*")
    .single();

  if (createError || !conversation) {
    console.error("Failed to create booking conversation:", createError);
    return ApiErrors.serverError();
  }

  // Add all parties as participants (customer + provider(s))
  const participantIds = [...new Set([booking.customer_id, ...providerIds])];
  const { error: participantError } = await supabase
    .from("conversation_participants")
    .insert(
      participantIds.map((profileId) => ({
        conversation_id: conversation.id,
        profile_id: profileId,
      }))
    );

  if (participantError) {
    console.error("Failed to add booking conversation participants:", participantError);
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
