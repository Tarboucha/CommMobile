import { prisma } from "@/lib/prisma";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { assertBookingParty, assertBookingProvider } from "@/lib/guards/assert-booking-party";
import { mapRpcError } from "@/lib/utils/rpc-errors";
import {
  IdempotencyHitError,
  NotFoundError,
  ValidationError,
  OfferingUnavailableError,
  VersionMismatchError,
  BookingNotAllowedError,
  InvalidStatusTransitionError,
} from "@/lib/errors/domain-errors";
import type { BookingCreateInput } from "@/lib/validations/booking";
import type { User } from "@/types/auth";

// ============================================================================
// Status transition rules (category-aware)
// ============================================================================

type BookingStatus = string;
type BookingCategory = "product" | "service" | "event" | "loan";

// Product: full pipeline (prepare → ready → complete)
const PRODUCT_PROVIDER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["completed"],
};

// Service: simplified (confirm → complete directly)
const SERVICE_PROVIDER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};

// Event: same as service
const EVENT_PROVIDER_TRANSITIONS = SERVICE_PROVIDER_TRANSITIONS;

// Loan: unique flow (confirm → loan out, return is via separate endpoint)
const LOAN_PROVIDER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["loaned_out", "cancelled"],
  loaned_out: [],
  returned: ["completed"],
};

const CUSTOMER_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["cancelled"],
};

function getProviderTransitions(category: BookingCategory): Record<string, BookingStatus[]> {
  switch (category) {
    case "service": return SERVICE_PROVIDER_TRANSITIONS;
    case "event": return EVENT_PROVIDER_TRANSITIONS;
    case "loan": return LOAN_PROVIDER_TRANSITIONS;
    default: return PRODUCT_PROVIDER_TRANSITIONS;
  }
}

// ============================================================================
// Create booking
// ============================================================================

export async function createBooking(user: User, input: BookingCreateInput) {
  // 1. Idempotency check
  const existing = await prisma.bookings.findFirst({
    where: { idempotency_key: input.idempotency_key, customer_id: user.id },
    select: {
      id: true,
      booking_number: true,
      booking_status: true,
      total_amount: true,
      currency_code: true,
      created_at: true,
    },
  });
  if (existing) throw new IdempotencyHitError({ booking: existing });

  // 2. Community membership
  await assertCommunityMember(input.community_id, user.id);

  // 3. Fetch offerings with images
  const offerings = await prisma.offerings.findMany({
    where: { id: { in: input.items.map((i) => i.offering_id) }, deleted_at: null },
    include: { offering_images: { select: { image_url: true, is_primary: true } } },
  });

  if (offerings.length !== input.items.length) {
    throw new ValidationError("One or more offerings are no longer available");
  }

  const offeringsMap = new Map(offerings.map((o) => [o.id, o]));

  // 4. Validate each item
  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id);
    if (!offering) throw new ValidationError(`Offering ${item.offering_id} not found`);
    if (offering.status !== "active") throw new OfferingUnavailableError(`"${offering.title}" is no longer available`);
    if (offering.community_id !== input.community_id) throw new ValidationError(`"${offering.title}" does not belong to this community`);
    if (offering.version !== item.offering_version) throw new VersionMismatchError(offering.title);
    if (offering.provider_id === user.id) throw new BookingNotAllowedError("You cannot book your own offering");
  }

  // 5. Single provider enforcement
  const providerIds = [...new Set(offerings.map((o) => o.provider_id))];
  if (providerIds.length !== 1) {
    throw new ValidationError("All items in a booking must be from the same provider");
  }
  const providerId = providerIds[0];

  // 6. Calculate amounts
  const currencyCode = offerings[0]?.currency_code ?? "EUR";
  let subtotalAmount = 0;
  let totalDeliveryFees = 0;
  let totalDeposit = 0;

  const itemsForRpc: Array<Record<string, unknown>> = [];

  for (const item of input.items) {
    const offering = offeringsMap.get(item.offering_id)!;
    const unitPrice = Number(offering.price_amount ?? 0);
    const itemTotal = unitPrice * item.quantity;
    subtotalAmount += itemTotal;

    let deliveryFee = 0;
    if (item.fulfillment_method === "delivery" && offering.is_delivery_available && offering.delivery_fee_amount) {
      deliveryFee = Number(offering.delivery_fee_amount);
      totalDeliveryFees += deliveryFee;
    }

    let itemDepositAmount: number | null = null;
    const isLoanItem = item.is_loan === true;
    if (isLoanItem && offering.requires_deposit && offering.deposit_amount) {
      itemDepositAmount = Number(offering.deposit_amount);
      totalDeposit += itemDepositAmount * item.quantity;
    }

    const offeringImage = offering.offering_images;

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
      snapshot_image_url: offeringImage?.image_url || null,
      snapshot_category: offering.category,
      snapshot_transaction_type: offering.transaction_type || "purchase",
      snapshot_price_type: offering.price_type || "fixed",
      special_instructions: item.special_instructions || null,
      instance_start_time: item.instance_start_time || null,
      instance_end_time: item.instance_end_time || null,
      is_loan: isLoanItem,
      loan_start_date: item.loan_start_date || null,
      loan_due_date: item.loan_due_date || null,
      deposit_amount: itemDepositAmount,
    });
  }

  const totalAmount = subtotalAmount + totalDeliveryFees + totalDeposit;

  // 7. Build booking payload and call RPC
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
    ...(input.offer_amount && { offer_amount: input.offer_amount }),
    ...(input.offer_note && { offer_note: input.offer_note }),
  };

  let newBookingId: string;
  try {
    const result = await prisma.$queryRaw<[{ create_booking_with_items: string }]>`
      SELECT public.create_booking_with_items(
        ${JSON.stringify(bookingData)}::jsonb,
        ${JSON.stringify(itemsForRpc)}::jsonb
      ) AS create_booking_with_items
    `;
    newBookingId = result[0].create_booking_with_items;
  } catch (err) {
    mapRpcError(err);
  }

  // 8. Fetch and return
  const newBooking = await prisma.bookings.findUnique({
    where: { id: newBookingId! },
  });
  if (!newBooking) throw new Error("Booking created but failed to retrieve");

  const conversation = await prisma.conversations.findFirst({
    where: { booking_id: newBookingId!, conversation_type: "booking" },
    select: { id: true },
  });

  return {
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
  };
}

// ============================================================================
// List bookings
// ============================================================================

export async function listBookings(userId: string, role?: string) {
  const where: any = {};
  if (role === "customer") where.customer_id = userId;
  else if (role === "provider") where.provider_id = userId;
  else where.OR = [{ customer_id: userId }, { provider_id: userId }];

  return prisma.bookings.findMany({
    where,
    include: {
      booking_items: {
        select: {
          id: true,
          offering_id: true,
          snapshot_title: true,
          snapshot_image_url: true,
          snapshot_category: true,
          quantity: true,
          is_loan: true,
          instance_date: true,
          instance_start_time: true,
          instance_end_time: true,
          loan_due_date: true,
          loan_returned_at: true,
        },
      },
      booking_customer_snapshots: {
        select: {
          snapshot_display_name: true,
          snapshot_first_name: true,
          snapshot_last_name: true,
        },
      },
      booking_community_snapshots: {
        select: { snapshot_community_name: true },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

// ============================================================================
// Get booking detail
// ============================================================================

export async function getBookingDetail(bookingId: string, userId: string) {
  const { booking } = await assertBookingParty(bookingId, userId);

  const [bookingItems, customerSnapshot, deliverySnapshot, communitySnapshot, statusHistory] =
    await Promise.all([
      prisma.booking_items.findMany({
        where: { booking_id: bookingId },
        include: {
          booking_provider_snapshots: true,
          booking_schedule_snapshots: true,
        },
        orderBy: { created_at: "asc" },
      }),
      prisma.booking_customer_snapshots.findFirst({ where: { booking_id: bookingId } }),
      prisma.booking_delivery_snapshots.findFirst({
        where: { booking_id: bookingId },
        include: { snapshot_addresses: true },
      }),
      prisma.booking_community_snapshots.findFirst({ where: { booking_id: bookingId } }),
      prisma.booking_status_history.findMany({
        where: { booking_id: bookingId },
        orderBy: { created_at: "asc" },
      }),
    ]);

  // Fetch full booking row (the guard only selected subset)
  const fullBooking = await prisma.bookings.findUnique({ where: { id: bookingId } });

  return {
    ...fullBooking,
    booking_items: bookingItems,
    customer_snapshot: customerSnapshot || null,
    delivery_snapshot: deliverySnapshot || null,
    community_snapshot: communitySnapshot || null,
    status_history: statusHistory,
  };
}

// ============================================================================
// Update booking status
// ============================================================================

export async function updateBookingStatus(
  bookingId: string,
  userId: string,
  newStatus: string,
  cancellationReason?: string
) {
  const { booking, isProvider } = await assertBookingParty(bookingId, userId);

  // Determine booking category from the first item
  const firstItem = await prisma.booking_items.findFirst({
    where: { booking_id: bookingId },
    select: { snapshot_category: true, is_loan: true },
  });

  const category: BookingCategory = firstItem?.is_loan
    ? "loan"
    : (firstItem?.snapshot_category as BookingCategory) ?? "product";

  const currentStatus = booking.booking_status as string;
  const allowedTransitions = isProvider
    ? getProviderTransitions(category)[currentStatus]
    : CUSTOMER_TRANSITIONS[currentStatus];

  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    const role = isProvider ? "provider" : "customer";
    throw new InvalidStatusTransitionError(currentStatus, newStatus, role);
  }

  const updateData: Record<string, unknown> = { booking_status: newStatus };

  switch (newStatus) {
    case "confirmed":
      updateData.confirmed_at = new Date();
      break;
    case "ready":
      updateData.ready_at = new Date();
      break;
    case "completed":
      updateData.completed_at = new Date();
      break;
    case "cancelled":
      updateData.cancelled_at = new Date();
      updateData.cancelled_by_id = userId;
      if (cancellationReason) updateData.cancellation_reason = cancellationReason;
      break;
    case "loaned_out":
      updateData.updated_at = new Date();
      break;
  }

  return prisma.bookings.update({
    where: { id: bookingId },
    data: updateData,
  });
}

// ============================================================================
// Return loan item
// ============================================================================

export async function returnLoanItem(
  bookingId: string,
  itemId: string,
  userId: string
) {
  // Provider-only
  await assertBookingProvider(bookingId, userId);

  // Validate item
  const item = await prisma.booking_items.findUnique({
    where: { id: itemId },
    select: { id: true, booking_id: true, is_loan: true, loan_returned_at: true },
  });

  if (!item || item.booking_id !== bookingId) throw new NotFoundError("Booking item");
  if (!item.is_loan) throw new ValidationError("This item is not a loan");
  if (item.loan_returned_at) throw new ValidationError("This item has already been returned");

  // Call RPC
  try {
    await prisma.$executeRaw`SELECT public.return_loan_item(${itemId}::uuid)`;
  } catch (err) {
    mapRpcError(err);
  }

  // Return updated booking detail
  return getBookingDetail(bookingId, userId);
}
