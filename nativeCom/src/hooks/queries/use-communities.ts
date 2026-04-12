import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import {
  getCommunities,
  browseCommunities,
  getCommunity,
  getCommunityMembers,
} from '@/lib/api/communities';

export function useMyCommunities(limit = 20) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.communities.mine(),
    queryFn: () => getCommunities(limit),
    enabled: !!user,
  });
}

export function useBrowseCommunities(limit = 20, search?: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...queryKeys.communities.browse(), search ?? ''] as const,
    queryFn: () => browseCommunities(limit, undefined, search),
    enabled: !!user,
  });
}

export function useCommunityDetail(communityId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.communities.detail(communityId!),
    queryFn: () => getCommunity(communityId!),
    enabled: !!user && !!communityId,
  });
}

export function useCommunityMembers(communityId: string | undefined, limit = 20) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.communities.members(communityId!),
    queryFn: () => getCommunityMembers(communityId!, limit),
    enabled: !!user && !!communityId,
  });
}
