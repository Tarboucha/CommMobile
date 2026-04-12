import { prisma } from "@/lib/prisma";
import { assertBookingParty } from "@/lib/guards/assert-booking-party";
import {
  NotFoundError,
  ValidationError,
  OfferNotPendingError,
  SelfActionError,
} from "@/lib/errors/domain-errors";

// ============================================================================
// Counter offer
// ============================================================================

export async function counterOffer(
  bookingId: string,
  userId: string,
  offeredAmount: number,
  note?: string
) {
  const { booking, } = await assertBookingParty(bookingId, userId);

  if (booking.booking_status !== "pending") {
    throw new ValidationError("Offers can only be made on pending bookings");
  }

  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
    select: { id: true },
  });
  if (!conversation) throw new NotFoundError("Booking conversation");

  const currency = booking.currency_code ?? "EUR";

  // Supersede existing pending offers
  await prisma.price_offers.updateMany({
    where: { booking_id: bookingId, offer_status: "pending" },
    data: { offer_status: "superseded", responded_at: new Date() },
  });

  // Create offer message
  const message = await prisma.messages.create({
    data: {
      conversation_id: conversation.id,
      sender_id: userId,
      content: note || `Offered ${offeredAmount} ${currency}`,
      message_type: "price_offer",
      metadata: { offered_amount: offeredAmount, currency, note: note || null },
    },
  });

  // Create price_offers row
  const offer = await prisma.price_offers.create({
    data: {
      booking_id: bookingId,
      conversation_id: conversation.id,
      message_id: message.id,
      offered_by: userId,
      offered_amount: offeredAmount,
      currency_code: currency,
      note: note || null,
      offer_status: "pending",
    },
  });

  // Update metadata with offer_id
  await prisma.messages.update({
    where: { id: message.id },
    data: {
      metadata: { offer_id: offer.id, offered_amount: offeredAmount, currency, note: note || null },
    },
  });

  // Update conversation preview
  await prisma.conversations.update({
    where: { id: conversation.id },
    data: {
      last_message_at: new Date(),
      last_message_preview: `Offered ${offeredAmount} ${currency}`,
    },
  });

  return { offer, message_id: message.id };
}

// ============================================================================
// Accept offer
// ============================================================================

export async function acceptOffer(
  bookingId: string,
  userId: string,
  offerId: string
) {
  await assertBookingParty(bookingId, userId);

  const offer = await prisma.price_offers.findUnique({
    where: { id: offerId },
  });

  if (!offer || offer.booking_id !== bookingId) throw new NotFoundError("Offer");
  if (offer.offer_status !== "pending") throw new OfferNotPendingError();
  if (offer.offered_by === userId) throw new SelfActionError("You cannot accept your own offer");

  const currency = offer.currency_code;

  // Update offer
  await prisma.price_offers.update({
    where: { id: offerId },
    data: { offer_status: "accepted", responded_at: new Date() },
  });

  // Update booking with agreed price
  await prisma.bookings.update({
    where: { id: bookingId },
    data: {
      total_amount: offer.offered_amount,
      subtotal_amount: offer.offered_amount,
      accepted_offer_id: offerId,
    },
  });

  // Find conversation for the response message
  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
    select: { id: true },
  });

  if (conversation) {
    await prisma.messages.create({
      data: {
        conversation_id: conversation.id,
        sender_id: userId,
        content: `Offer of ${offer.offered_amount} ${currency} accepted`,
        message_type: "offer_response",
        metadata: {
          offer_id: offerId,
          action: "accepted",
          agreed_amount: Number(offer.offered_amount),
        },
      },
    });

    await prisma.conversations.update({
      where: { id: conversation.id },
      data: {
        last_message_at: new Date(),
        last_message_preview: `Offer accepted: ${offer.offered_amount} ${currency}`,
      },
    });
  }

  return { offer: { ...offer, offer_status: "accepted" }, agreed_amount: Number(offer.offered_amount) };
}

// ============================================================================
// Decline offer
// ============================================================================

export async function declineOffer(
  bookingId: string,
  userId: string,
  offerId: string
) {
  const { isProvider } = await assertBookingParty(bookingId, userId);

  const offer = await prisma.price_offers.findUnique({
    where: { id: offerId },
  });

  if (!offer || offer.booking_id !== bookingId) throw new NotFoundError("Offer");
  if (offer.offer_status !== "pending") throw new OfferNotPendingError();
  if (offer.offered_by === userId) throw new SelfActionError("You cannot decline your own offer");

  // Update offer
  await prisma.price_offers.update({
    where: { id: offerId },
    data: { offer_status: "declined", responded_at: new Date() },
  });

  // If provider declines, cancel the booking
  if (isProvider) {
    await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        booking_status: "cancelled",
        cancelled_at: new Date(),
        cancelled_by_id: userId,
        cancellation_reason: "Provider declined the offer",
      },
    });
  }

  // Insert response message
  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
    select: { id: true },
  });

  if (conversation) {
    await prisma.messages.create({
      data: {
        conversation_id: conversation.id,
        sender_id: userId,
        content: "Offer declined",
        message_type: "offer_response",
        metadata: { offer_id: offerId, action: "declined" },
      },
    });

    await prisma.conversations.update({
      where: { id: conversation.id },
      data: { last_message_at: new Date(), last_message_preview: "Offer declined" },
    });
  }

  return { offer: { ...offer, offer_status: "declined" } };
}

// ============================================================================
// List offers
// ============================================================================

export async function listOffers(bookingId: string, userId: string) {
  await assertBookingParty(bookingId, userId);

  return prisma.price_offers.findMany({
    where: { booking_id: bookingId },
    orderBy: { created_at: "asc" },
  });
}
