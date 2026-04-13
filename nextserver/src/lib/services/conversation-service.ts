import { prisma } from "@/lib/prisma";
import { assertBookingParty } from "@/lib/guards/assert-booking-party";
import { mapRpcError } from "@/lib/utils/rpc-errors";

// ============================================================================
// Booking conversation
// ============================================================================

/**
 * Get or create the conversation for a booking.
 * Conversations are created atomically with bookings (via RPC).
 * The fallback RPC creation handles legacy bookings created before
 * the atomic conversation feature.
 *
 * Returns { conversation, created } where created is true if a new
 * conversation was made via the fallback path.
 */
export async function getOrCreateBookingConversation(
  bookingId: string,
  userId: string
) {
  await assertBookingParty(bookingId, userId);

  // Look up existing conversation (should always exist for new bookings)
  const existing = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
  });

  if (existing) {
    return { conversation: existing, created: false };
  }

  // Fallback: create via RPC for legacy bookings without a conversation
  let conversationId: string;
  try {
    const result = await prisma.$queryRaw<[{ create_booking_conversation: string }]>`
      SELECT public.create_booking_conversation(
        ${bookingId}::uuid,
        ${userId}::uuid
      ) AS create_booking_conversation
    `;
    conversationId = result[0].create_booking_conversation;
  } catch (err) {
    mapRpcError(err);
  }

  const conversation = await prisma.conversations.findUnique({
    where: { id: conversationId! },
  });

  return { conversation, created: true };
}
