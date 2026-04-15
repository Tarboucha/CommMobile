/**
 * Storage utilities for converting storage paths to public URLs
 */

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;

/**
 * Convert storage path to public CDN URL
 *
 * @param storagePath - Storage path: `profile-avatars/user-id/avatar.jpg` OR full URL
 * @returns Full CDN URL or original URL if already a full URL, or null if invalid
 */
export function getPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  // If it's already a full URL, return as-is
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }

  if (!R2_PUBLIC_URL) {
    return null;
  }

  return `${R2_PUBLIC_URL}/${storagePath}`;
}
