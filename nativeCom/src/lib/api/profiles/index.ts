import { fetchAPI } from '@/lib/api/client';
import { uploadImageToR2 } from '@/lib/storage/upload-image';
import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * Update a user's profile
 */
export async function updateProfile(
  profileId: string,
  data: { first_name?: string; last_name?: string; phone?: string | null }
) {
  return fetchAPI(`/api/v1/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Upload a new avatar.
 *   1. Resize + re-encode via expo-image-manipulator
 *   2. Sign an upload URL from kodo-api
 *   3. PUT bytes directly to R2
 *   4. POST the resulting key to /avatar to atomically replace the old one
 */
export async function uploadAvatar(profileId: string, asset: ImagePickerAsset) {
  const { key } = await uploadImageToR2({
    signPath: `/api/v1/profiles/${profileId}/avatar/sign`,
    asset,
    maxDimension: 1024, // avatars are displayed small
  });
  return fetchAPI<{ profile: { id: string; avatar_url: string } }>(
    `/api/v1/profiles/${profileId}/avatar`,
    {
      method: 'POST',
      body: JSON.stringify({ key }),
    }
  );
}

/**
 * Delete avatar image (clears avatar_url + removes R2 object best-effort).
 */
export async function deleteAvatar(profileId: string) {
  return fetchAPI(`/api/v1/profiles/${profileId}/avatar`, { method: 'DELETE' });
}
