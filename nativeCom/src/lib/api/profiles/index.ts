import { fetchAPI, uploadAPI } from '@/lib/api/client';

/**
 * Update a user's profile
 */
export async function updateProfile(
  profileId: string,
  data: { first_name?: string; last_name?: string; phone?: string | null }
) {
  return fetchAPI(`/api/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(profileId: string, formData: FormData) {
  return uploadAPI<{ message: string; avatar_url: string }>(
    `/api/profiles/${profileId}/avatar/upload`,
    formData
  );
}

/**
 * Delete avatar image
 */
export async function deleteAvatar(profileId: string) {
  return fetchAPI(`/api/profiles/${profileId}/avatar`, { method: 'DELETE' });
}
