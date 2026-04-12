import { NextRequest } from "next/server";
import { withAuth, withSecureAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { bookingCreateSchema, type BookingCreateInput } from "@/lib/validations/booking";


/**
 * POST /api/bookings
 * Create a new booking with atomic slot reservation.
 * Uses withSecureAuth (server-verified session) for financial operations.
 */
export const POST = withSecureAuth(async (user, request: NextRequest) => {
  console.log("[bookings] POST handler entered, user:", user.id);

  // Parse request body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }
  console.log("[bookings] Body parsed, community:", (rawData as any).community_id);

  // Validate with Zod
  const validation = bookingCreateSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return ApiErrors.badRequest(firstError.message);
  }

  const input: BookingCreateInput = validation.data;
  const supabase = await createClient();

  // ============================================================================
  // Step 1: Idempotency check
  // ============================================================================
  const { data: existingBooking, error: idempotencyError } = await supabase
    .from("bookings")
    .select("id, booking_number, booking_status, total_amount, currency_code, created_at")
    .eq("idempotency_key", input.idempotency_key)
    .eq("customer_id", user.id)
    .maybeSingle();

  console.log("[bookings] Step 1 done - idempotency check:", { error: idempotencyError?.message, exists: !!existingBooking });

  if (idempotencyError) {
    console.error("Error checking idempotency:", idempotencyError);
    return ApiErrors.serverError();
  }

  if (existingBooking) {
    return successResponse({ booking: existingBooking });
  }

  // ============================================================================
  // Step 2: Verify community membership
  // ============================================================================
  const { data: membership, error: memberError } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", input.community_id)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .maybeSingle();

  if (memberError) {
    console.error("Error checking membership:", memberError);
    return ApiErrors.serverError();
  }

  if (!membership) {
    return ApiErrors.notCommunityMember();
  }

  // ============================================================================
  // Step 3: Fetch offerings with provider profiles
  // ============================================================================
  const offeringIds = input.items.map((item) => item.offering_id);

  const { data: offerings, error: offeringsError } = await supabase
    .from("offerings")
    .select(`
      id,
      community_id,
      provider_id,
      category,
      transaction_type,
      title,
      description,
      price_amount,
      currency_code,
      fulfillment_method,
      is_delivery_available,
      delivery_fee_amount,
      pickup_address_id,
      requires_deposit,
      deposit_amount,
      price_type,
      version,
      status,
      offering_images (
        image_url,
        is_primary
      ),
      profiles!provider_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url
      )
    `)
    .in("id", offeringIds)
    .is("deleted_at", null);

  if (offeringsError) {
    console.error("Error fetching offerings:", offeringsError);
    return ApiErrors.serverError();
  }

  if (!offerings || offerings.length !== offeringIds.length) {
    return ApiErrors.badRequest("One or more offerings are no longer available");
  }

  const offeringsMap = new Map(offerings.map((o) => [o.id, o]));

  // ============================================================================
  // Step 4: Pre-validate each item (fail fast before RPC)
  // ============================================================================
  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id);
    if (!offering) {
      return ApiErrors.badRequest(`Offering ${item.offering_id} not found`);
    }

    if (offering.status !== "active") {
      return ApiErrors.offeringUnavailable(`"${offering.title}" is no longer available`);
    }

    if (offering.community_id !== input.community_id) {
      return ApiErrors.badRequest(`"${offering.title}" does not belong to this community`);
    }

    if (offering.version !== item.offering_version) {
      return ApiErrors.conflict(
        `"${offering.title}" has been updated. Please refresh your cart and try again.`
      );
    }

    if (offering.provider_id === user.id) {
      return ApiErrors.bookingNotAllowed("You cannot book your own offering");
    }
  }

  // Validate single provider (split-at-checkout: frontend groups by provider)
  const providerIds = [...new Set(offerings.map((o) => o.provider_id))];
  if (providerIds.length !== 1) {
    return ApiErrors.badRequest(
      "All items in a booking must be from the same provider. Please split your cart."
    );
  }
  const providerId = providerIds[0];

  // ============================================================================
  // Step 5: Calculate amounts
  // ============================================================================
  const currencyCode = offerings[0]?.currency_code || "EUR";
  let subtotalAmount = 0;
  let totalDeliveryFees = 0;
  let totalDeposit = 0;

  const itemsForRpc: Array<Record<string, unknown>> = [];

  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id)!;
    const unitPrice = offering.price_amount || 0;
    const itemTotal = unitPrice * item.quantity;
    subtotalAmount += itemTotal;

    // Delivery fee
    let deliveryFee = 0;
    if (
      item.fulfillment_method === "delivery" &&
      offering.is_delivery_available &&
      offering.delivery_fee_amount
    ) {
      deliveryFee = offering.delivery_fee_amount;
      totalDeliveryFees += deliveryFee;
    }

    // Loan-specific: deposit (use offering's deposit_amount if requires_deposit)
    let itemDepositAmount: number | null = null;
    const isLoanItem = item.is_loan === true;
    if (isLoanItem && offering.requires_deposit && offering.deposit_amount) {
      itemDepositAmount = Number(offering.deposit_amount);
      totalDeposit += itemDepositAmount * item.quantity;
    }

    itemsForRpc.push({
      offering_id: item.offering_id,
      offering_version: item.offering_version,
      quantity: item.quantity,
      fulfillment_method: item.fulfillment_method,
      schedule_id: item.schedule_id || null,
      instance_date: item.instance_date || null,
      unit_price_amount: unitPrice,
      total_amount: itemTotal,
      delivery_fee_amount: deliveryFee,
      currency_code: currencyCode,
      snapshot_title: offering.title,
      snapshot_description: offering.description || null,
      snapshot_image_url:
        offering.offering_images?.find((img) => img.is_primary)?.image_url ||
        offering.offering_images?.[0]?.image_url ||
        null,
      snapshot_category: offering.category,
      snapshot_transaction_type: offering.transaction_type || "purchase",
      snapshot_price_type: offering.price_type || "fixed",
      special_instructions: item.special_instructions || null,
      // Time-slotted fields
      instance_start_time: item.instance_start_time || null,
      instance_end_time: item.instance_end_time || null,
      // Loan fields
      is_loan: isLoanItem,
      loan_start_date: item.loan_start_date || null,
      loan_due_date: item.loan_due_date || null,
      deposit_amount: itemDepositAmount,
    });
  }

  const totalAmount = subtotalAmount + totalDeliveryFees + totalDeposit;

  // ============================================================================
  // Step 6: Build booking data and call RPC
  // ============================================================================
  const bookingData = {
    customer_id: user.id,
    provider_id: providerId,
    community_id: input.community_id,
    idempotency_key: input.idempotency_key,
    payment_method: input.payment_method,
    delivery_address_id: input.delivery_address_id || null,
    special_instructions: input.special_instructions || null,
    currency_code: currencyCode,
    subtotal_amount: subtotalAmount,
    service_fee_amount: 0,
    total_amount: totalAmount,
    deposit_total: totalDeposit,
    deposit_status: totalDeposit > 0 ? "held" : "none",
    // Offer fields (passed to RPC for conversation + price_offer creation)
    ...(input.offer_amount && { offer_amount: input.offer_amount }),
    ...(input.offer_note && { offer_note: input.offer_note }),
  };

  const { data: newBookingId, error: rpcError } = await supabase.rpc(
    "create_booking_with_items",
    {
      p_booking: bookingData,
      p_items: itemsForRpc,
    }
  );

  if (rpcError || !newBookingId) {
    console.error("Error creating booking:", rpcError);

    if (rpcError) {
      const msg = rpcError.message || "";

      if (msg.includes("Not enough slots")) {
        return ApiErrors.slotsUnavailable(
          "One or more items are fully booked for the selected date. Please update your cart."
        );
      }
      if (msg.includes("cancelled")) {
        return ApiErrors.offeringUnavailable(
          "One or more items are no longer available for the selected date."
        );
      }
      if (msg.includes("not found or inactive")) {
        return ApiErrors.offeringUnavailable(
          "One or more schedules are no longer available."
        );
      }
      if (msg.includes("version mismatch")) {
        return ApiErrors.conflict(
          "One or more offerings have been updated. Please refresh your cart."
        );
      }
      if (msg.includes("Cannot book your own offering")) {
        return ApiErrors.bookingNotAllowed("You cannot book your own offering");
      }
    }

    return ApiErrors.serverError("Failed to create booking");
  }

  // ============================================================================
  // Step 7: Fetch created booking (snapshots already created atomically inside
  // the RPC via insert_booking_aux_snapshots).
  // ============================================================================
  const newBooking = await prisma.bookings.findUnique({
    where: { id: newBookingId as string },
  });

  if (!newBooking) {
    return ApiErrors.serverError("Booking created but failed to retrieve details");
  }

  // Fetch the conversation created by the RPC
  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: newBookingId as string, conversation_type: "booking" },
    select: { id: true },
  });

  return successResponse(
    {
      booking: {
        id: newBooking.id,
        booking_number: newBooking.booking_number,
        booking_status: newBooking.booking_status,
        community_id: newBooking.community_id,
        subtotal_amount: newBooking.subtotal_amount,
        total_amount: newBooking.total_amount,
        currency_code: newBooking.currency_code,
        payment_method: newBooking.payment_method,
        created_at: newBooking.created_at,
        conversation_id: conversation?.id ?? null,
      },
    },
    "Booking created successfully",
    201
  );
});

// ============================================================================
// GET /api/bookings
// List bookings for the current user (as customer and/or provider).
// Query params: ?role=customer|provider (optional, defaults to both)
// ============================================================================

export const GET = withAuth(async (user, request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  try {
    const where: any = {};

    if (role === "customer") {
      where.customer_id = user.id;
    } else if (role === "provider") {
      where.provider_id = user.id;
    } else {
      where.OR = [
        { customer_id: user.id },
        { provider_id: user.id },
      ];
    }

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        booking_items: {
          select: { id: true, snapshot_title: true, snapshot_image_url: true, quantity: true },
        },
        booking_community_snapshots: {
          select: { snapshot_community_name: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return successResponse({ bookings: bookings as any });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return ApiErrors.serverError("Failed to fetch bookings");
  }
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
