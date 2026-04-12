import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getTimeSlots } from '@/lib/api/offerings';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Fetches computed time slots for a time-slotted schedule on a given date.
 * Only enabled when all params are set and user is authenticated.
 * Returns empty slots array for date-based schedules (no slot_duration_minutes).
 */
export function useTimeSlots(
  offeringId: string | undefined,
  scheduleId: string | undefined,
  date: string | null
) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.offerings.timeSlots(scheduleId ?? '', date ?? ''),
    queryFn: () => getTimeSlots(offeringId!, scheduleId!, date!),
    enabled: !!user && !!offeringId && !!scheduleId && !!date,
    staleTime: 30 * 1000, // 30s — slots change as people book
  });
}
