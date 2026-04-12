import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  createOffering,
  updateOffering,
  deleteOffering,
} from '@/lib/api/offerings';
import type { CreateOfferingInput, UpdateOfferingInput } from '@/types/offering';

export function useCreateOffering(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOfferingInput) => createOffering(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerings.community(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.board.feed(communityId) });
    },
  });
}

export function useUpdateOffering(offeringId: string, communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOfferingInput) => updateOffering(offeringId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerings.detail(offeringId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.offerings.community(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.board.feed(communityId) });
    },
  });
}

export function useDeleteOffering(offeringId: string, communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteOffering(offeringId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerings.community(communityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.board.feed(communityId) });
    },
  });
}
