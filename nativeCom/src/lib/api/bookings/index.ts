import { fetchAPI } from '@/lib/api/client';
import type {
  BookingCreatePayload,
  BookingResponse,
  BookingListItem,
  BookingDetail,
  BookingStatusUpdatePayload,
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
