import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getCalendarBookings } from '@/lib/api/bookings';
import { useAuthStore } from '@/lib/stores/auth-store';

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Fetches all bookings for the user in a given month, grouped by date.
 * Returns dates map + event_counts for calendar dot indicators.
 */
export function useCalendarBookings(month: Date) {
  const user = useAuthStore((s) => s.user);
  const monthStr = formatMonth(month);

  return useQuery({
    queryKey: [...queryKeys.bookings.all, 'calendar', monthStr],
    queryFn: () => getCalendarBookings(monthStr),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min — navigating between months uses cache
  });
}
