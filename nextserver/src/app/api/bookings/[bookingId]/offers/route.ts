import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

// ============================================================================
// Validation
// ============================================================================

const counterOfferSchema = z.object({
  action: z.literal("counter"),
  offered_amount: z.number().positive("Offer amount must be positive"),
  note: z.string().max(500).optional(),
});

const acceptOfferSchema = z.object({
  action: z.literal("accept"),
  offer_id: z.string().uuid(),
});

const declineOfferSchema = z.object({
  action: z.literal("decline"),
  offer_id: z.string().uuid(),
});

const offerActionSchema = z.discriminatedUnion("action", [
  counterOfferSchema,
  acceptOfferSchema,
  declineOfferSchema,
]);

// ============================================================================
// POST /api/bookings/:bookingId/offers
// ============================================================================

export const POST = withAuth(async (user, request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return ApiErrors.badRequest("Booking ID is required");

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON");
  }

  const validation = offerActionSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  // Load booking + conversation
  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customer_id: true,
      provider_id: true,
      booking_status: true,
      total_amount: true,
      subtotal_amount: true,
      currency_code: true,
    },
  });

  if (!booking) return ApiErrors.notFound("Booking");

  const isCustomer = booking.customer_id === user.id;
  const isProvider = booking.provider_id === user.id;
  if (!isCustomer && !isProvider) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  if (booking.booking_status !== "pending") {
    return ApiErrors.badRequest(
      "Offers can only be made on pending bookings"
    );
  }

  // Find the booking's conversation
  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: "booking" },
    select: { id: true },
  });

  if (!conversation) {
    return ApiErrors.serverError("Booking conversation not found");
  }

  const currency = booking.currency_code ?? "EUR";

  // ─── Counter offer ──────────────────────────────────────────────────────
  if (input.action === "counter") {
    // Supersede any existing pending offer
    await prisma.price_offers.updateMany({
      where: { booking_id: bookingId, offer_status: "pending" },
      data: { offer_status: "superseded", responded_at: new Date() },
    });

    // Create the offer message
    const message = await prisma.messages.create({
      data: {
        conversation_id: conversation.id,
        sender_id: user.id,
        content: input.note || `Offered ${input.offered_amount} ${currency}`,
        message_type: "price_offer",
        metadata: {
          offered_amount: input.offered_amount,
          currency,
          note: input.note || null,
        },
      },
    });

    // Create price_offer row
    const offer = await prisma.price_offers.create({
      data: {
        booking_id: bookingId,
        conversation_id: conversation.id,
        message_id: message.id,
        offered_by: user.id,
        offered_amount: input.offered_amount,
        currency_code: currency,
        note: input.note || null,
        offer_status: "pending",
      },
    });

    // Update message metadata with offer_id
    await prisma.messages.update({
      where: { id: message.id },
      data: {
        metadata: {
          offer_id: offer.id,
          offered_amount: input.offered_amount,
          currency,
          note: input.note || null,
        },
      },
    });

    // Update conversation preview
    await prisma.conversations.update({
      where: { id: conversation.id },
      data: {
        last_message_at: new Date(),
        last_message_preview: `Offered ${input.offered_amount} ${currency}`,
      },
    });

    return successResponse({ offer: offer as any, message_id: message.id }, undefined, 201);
  }

  // ─── Accept / Decline ──��────────────────────────────────────────────────
  const offer = await prisma.price_offers.findUnique({
    where: { id: input.offer_id },
    select: {
      id: true,
      booking_id: true,
      offered_by: true,
      offered_amount: true,
      offer_status: true,
      currency_code: true,
    },
  });

  if (!offer || offer.booking_id !== bookingId) {
    return ApiErrors.notFound("Offer");
  }

  if (offer.offer_status !== "pending") {
    return ApiErrors.badRequest("This offer is no longer pending");
  }

  // Can't accept/decline your own offer
  if (offer.offered_by === user.id) {
    return ApiErrors.badRequest("You cannot accept or decline your own offer");
  }

  if (input.action === "accept") {
    // Update offer status
    await prisma.price_offers.update({
      where: { id: offer.id },
      data: { offer_status: "accepted", responded_at: new Date() },
    });

    // Update booking with agreed price
    await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        total_amount: offer.offered_amount,
        subtotal_amount: offer.offered_amount,
        accepted_offer_id: offer.id,
      },
    });

    // Insert offer_response message
    const message = await prisma.messages.create({
      data: {
        conversation_id: conversation.id,
        sender_id: user.id,
        content: `Offer of ${offer.offered_amount} ${currency} accepted`,
        message_type: "offer_response",
        metadata: {
          offer_id: offer.id,
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

    return successResponse({
      offer: { ...offer, offer_status: "accepted" } as any,
      message_id: message.id,
      agreed_amount: Number(offer.offered_amount),
    });
  }

  if (input.action === "decline") {
    // Update offer status
    await prisma.price_offers.update({
      where: { id: offer.id },
      data: { offer_status: "declined", responded_at: new Date() },
    });

    // Insert offer_response message
    const message = await prisma.messages.create({
      data: {
        conversation_id: conversation.id,
        sender_id: user.id,
        content: "Offer declined",
        message_type: "offer_response",
        metadata: {
          offer_id: offer.id,
          action: "declined",
        },
      },
    });

    // If provider declines, cancel the booking
    if (isProvider) {
      await prisma.bookings.update({
        where: { id: bookingId },
        data: {
          booking_status: "cancelled",
          cancelled_at: new Date(),
          cancelled_by_id: user.id,
          cancellation_reason: "Provider declined the offer",
        },
      });
    }

    await prisma.conversations.update({
      where: { id: conversation.id },
      data: {
        last_message_at: new Date(),
        last_message_preview: "Offer declined",
      },
    });

    return successResponse({
      offer: { ...offer, offer_status: "declined" } as any,
      message_id: message.id,
    });
  }

  return ApiErrors.badRequest("Invalid action");
});

// ============================================================================
// GET /api/bookings/:bookingId/offers — list all offers for a booking
// ============================================================================

export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const bookingId = params?.bookingId;
  if (!bookingId) return ApiErrors.badRequest("Booking ID is required");

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: { customer_id: true, provider_id: true },
  });

  if (!booking) return ApiErrors.notFound("Booking");

  if (booking.customer_id !== user.id && booking.provider_id !== user.id) {
    return ApiErrors.forbidden("You are not a party to this booking");
  }

  const offers = await prisma.price_offers.findMany({
    where: { booking_id: bookingId },
    orderBy: { created_at: "asc" },
  });

  return successResponse({ offers: offers as any });
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
