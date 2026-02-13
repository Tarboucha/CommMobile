/**
 * Storage utilities for converting storage paths to public URLs
 */

/**
 * Convert storage path to public CDN URL
 *
 * @param storagePath - Storage path: `bucket/path/to/file.jpg` OR full URL: `https://...`
 * @returns Full CDN URL or original URL if already a full URL, or null if invalid
 *
 * @example
 * ```ts
 * const cdnUrl = getPublicUrl("profile-avatars/user-id/avatar.jpg");
 * // Returns: "https://api.kodo.app/storage/v1/object/public/profile-avatars/user-id/avatar.jpg"
 *
 * const oldUrl = getPublicUrl("https://lh3.googleusercontent.com/...");
 * // Returns: "https://lh3.googleusercontent.com/..." (unchanged)
 * ```
 */
export function getPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  // If it's already a full URL (http:// or https://), return as-is
  // This handles old avatar URLs from Google, etc. that are still in the database
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  // Remove trailing slash from Supabase URL if present
  // This prevents double slashes in the final URL
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  // Construct CDN URL for storage paths
  // No query parameters needed - paths are unique (include timestamps)
  return `${baseUrl}/storage/v1/object/public/${storagePath}`;
}
