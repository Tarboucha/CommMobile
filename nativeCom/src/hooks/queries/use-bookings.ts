import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { getMyBookings, getBooking } from '@/lib/api/bookings';

export function useMyBookings(role?: 'customer' | 'provider') {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.bookings.list(role),
    queryFn: () => getMyBookings(role),
    enabled: !!user,
  });
}

export function useBookingDetail(bookingId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.bookings.detail(bookingId!),
    queryFn: () => getBooking(bookingId!),
    enabled: !!user && !!bookingId,
  });
}
