import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { createBooking, returnLoanItem, submitOffer, updateBookingStatus } from '@/lib/api/bookings';
import type { BookingCreatePayload, BookingStatusUpdatePayload, OfferActionPayload } from '@/types/booking';

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingCreatePayload) => createBooking(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useUpdateBookingStatus(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BookingStatusUpdatePayload) => updateBookingStatus(bookingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useReturnLoanItem(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => returnLoanItem(bookingId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useSubmitOffer(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OfferActionPayload) => submitOffer(bookingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
