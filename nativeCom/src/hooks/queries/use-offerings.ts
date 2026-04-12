import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import {
  getCommunityOfferings,
  getOffering,
  getOfferingSchedules,
  type OfferingsFilter,
} from '@/lib/api/offerings';

export function useCommunityOfferings(
  communityId: string | undefined,
  limit = 20,
  filter?: OfferingsFilter
) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [
      ...queryKeys.offerings.community(communityId!),
      filter?.category ?? '',
      filter?.transactionType ?? '',
    ] as const,
    queryFn: () => getCommunityOfferings(communityId!, limit, undefined, filter),
    enabled: !!user && !!communityId,
  });
}

export function useOffering(offeringId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.offerings.detail(offeringId!),
    queryFn: () => getOffering(offeringId!),
    enabled: !!user && !!offeringId,
  });
}

export function useOfferingSchedules(offeringId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.offerings.schedules(offeringId!),
    queryFn: () => getOfferingSchedules(offeringId!),
    enabled: !!user && !!offeringId,
  });
}
