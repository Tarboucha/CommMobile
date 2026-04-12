import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  joinCommunity,
  leaveCommunity,
  createCommunity,
  acceptInviteLink,
} from '@/lib/api/communities';
import type { CreateCommunityInput } from '@/types/community';

export function useJoinCommunity(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinCommunity(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.members(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine() });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.browse() });
    },
  });
}

export function useLeaveCommunity(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveCommunity(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.members(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine() });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.browse() });
    },
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommunityInput) => createCommunity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine() });
    },
  });
}

export function useAcceptInviteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInviteLink(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine() });
    },
  });
}
