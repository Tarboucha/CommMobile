import { fetchAPI } from '@/lib/api/client';
import type {
  BookingCreatePayload,
  BookingResponse,
  BookingListItem,
  BookingDetail,
  BookingStatusUpdatePayload,
  OfferActionPayload,
  PriceOffer,
} from '@/types/booking';

/**
 * Fetch user's bookings (as customer and/or provider).
 * @param role - "customer" | "provider" | undefined (both)
 */
export async function getMyBookings(
  role?: 'customer' | 'provider'
): Promise<BookingListItem[]> {
  const params = role ? `?role=${role}` : '';
  const response = await fetchAPI<{
    success: boolean;
    data: { bookings: BookingListItem[] };
  }>(`/api/bookings${params}`, { method: 'GET' });

  return response.data.bookings;
}

/**
 * Create a new booking.
 * retry: false because idempotency key handles duplicates.
 */
export async function createBooking(
  payload: BookingCreatePayload
): Promise<BookingResponse> {
  const response = await fetchAPI<{
    success: boolean;
    data: { booking: BookingResponse };
  }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
    retry: false,
  });

  return response.data.booking;
}

/**
 * Fetch a booking by ID (with items, snapshots, status history).
 */
export async function getBooking(bookingId: string): Promise<BookingDetail> {
  const response = await fetchAPI<{
    success: boolean;
    data: { booking: BookingDetail };
  }>(`/api/bookings/${bookingId}`, { method: 'GET' });

  return response.data.booking;
}

/**
 * Update booking status (accept, refuse, advance, cancel).
 * DB trigger handles notifications + status history automatically.
 */
export async function updateBookingStatus(
  bookingId: string,
  data: BookingStatusUpdatePayload
): Promise<BookingDetail> {
  const response = await fetchAPI<{
    success: boolean;
    data: { booking: BookingDetail };
  }>(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  return response.data.booking;
}

/**
 * Mark a loan booking item as returned. Only the provider can trigger this.
 * Server calls the `return_loan_item` RPC which releases the reserved slots
 * and sets booking status to `returned` once all loan items are back.
 */
export async function returnLoanItem(
  bookingId: string,
  itemId: string
): Promise<BookingDetail> {
  const response = await fetchAPI<{
    success: boolean;
    data: { booking: BookingDetail };
  }>(`/api/bookings/${bookingId}/items/${itemId}/return`, {
    method: 'POST',
    retry: false,
  });

  return response.data.booking;
}

/**
 * Submit a price offer action (counter, accept, decline) on a booking.
 */
export async function submitOffer(
  bookingId: string,
  payload: OfferActionPayload
): Promise<{ offer: PriceOffer; message_id: string; agreed_amount?: number }> {
  const response = await fetchAPI<{
    success: boolean;
    data: { offer: PriceOffer; message_id: string; agreed_amount?: number };
  }>(`/api/bookings/${bookingId}/offers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}

/**
 * List all offers for a booking.
 */
export async function getOffers(bookingId: string): Promise<PriceOffer[]> {
  const response = await fetchAPI<{
    success: boolean;
    data: { offers: PriceOffer[] };
  }>(`/api/bookings/${bookingId}/offers`, { method: 'GET' });

  return response.data.offers;
}
