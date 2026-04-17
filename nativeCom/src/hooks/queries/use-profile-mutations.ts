import { useMutation } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useAuthStore } from '@/lib/stores/auth-store';
import { updateProfile, uploadAvatar, deleteAvatar } from '@/lib/api/profiles';

export function useUpdateProfile(profileId: string) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  return useMutation({
    mutationFn: (data: { first_name?: string; last_name?: string; phone?: string | null }) =>
      updateProfile(profileId, data),
    onSuccess: () => {
      fetchUser();
    },
  });
}

export function useUploadAvatar(profileId: string) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  return useMutation({
    mutationFn: (asset: ImagePickerAsset) => uploadAvatar(profileId, asset),
    onSuccess: () => {
      fetchUser();
    },
  });
}

export function useDeleteAvatar(profileId: string) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  return useMutation({
    mutationFn: () => deleteAvatar(profileId),
    onSuccess: () => {
      fetchUser();
    },
  });
}
