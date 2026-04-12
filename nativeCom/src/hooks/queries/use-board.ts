import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { getBoardFeed, getCommunityPosts } from '@/lib/api/board';

export function useBoardFeed(communityId: string | undefined, limit = 20) {
  const user = useAuthStore((s) => s.user);
  return useInfiniteQuery({
    queryKey: queryKeys.board.feed(communityId!),
    queryFn: ({ pageParam }) => getBoardFeed(communityId!, limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
    enabled: !!user && !!communityId,
  });
}

export function useCommunityPosts(communityId: string | undefined, limit = 20) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...queryKeys.board.all, 'posts', communityId] as const,
    queryFn: () => getCommunityPosts(communityId!, limit),
    enabled: !!user && !!communityId,
  });
}
