import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors/domain-errors";

interface BookingPartyResult {
  booking: {
    id: string;
    customer_id: string;
    provider_id: string;
    booking_status: string | null;
    community_id: string;
    total_amount: unknown;
    subtotal_amount: unknown;
    currency_code: string | null;
    accepted_offer_id: string | null;
  };
  isCustomer: boolean;
  isProvider: boolean;
}

/**
 * Asserts that the user is either the customer or the provider of the booking.
 * Throws NotFoundError or ForbiddenError on failure.
 * Returns the booking + role flags on success.
 */
export async function assertBookingParty(
  bookingId: string,
  userId: string
): Promise<BookingPartyResult> {
  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customer_id: true,
      provider_id: true,
      booking_status: true,
      community_id: true,
      total_amount: true,
      subtotal_amount: true,
      currency_code: true,
      accepted_offer_id: true,
    },
  });

  if (!booking) throw new NotFoundError("Booking");

  const isCustomer = booking.customer_id === userId;
  const isProvider = booking.provider_id === userId;

  if (!isCustomer && !isProvider) {
    throw new ForbiddenError("You are not a party to this booking");
  }

  return { booking, isCustomer, isProvider };
}

/**
 * Asserts that the user is the provider of the booking.
 * Used for provider-only actions (accept, mark ready, return loan item, etc.).
 */
export async function assertBookingProvider(bookingId: string, userId: string) {
  const result = await assertBookingParty(bookingId, userId);
  if (!result.isProvider) {
    throw new ForbiddenError("Only the provider can perform this action");
  }
  return result;
}
