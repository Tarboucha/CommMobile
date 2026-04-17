/**
 * MIME allowlist + per-entity size caps. Documented in storage-strategy.md.
 *
 * Accept at the API boundary: JPEG, PNG, WebP, HEIC, HEIF.
 * The client re-encodes to JPEG before upload; other types are accepted
 * as a convenience fallback (non-Expo clients, share sheet uploads, etc.).
 *
 * Reject: GIF (anim), SVG (XSS), BMP/TIFF (huge), AVIF (patchy decoding),
 * RAW (CR2/NEF/DNG/…).
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(contentType: string): contentType is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

/**
 * Per-entity size caps — enforced via the presigned URL's Content-Length
 * condition, and checked again at DB-row creation.
 */
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024,
  OFFERING_IMAGE: 5 * 1024 * 1024,
  COMMUNITY_IMAGE: 5 * 1024 * 1024,
  COMMUNITY_POST_IMAGE: 5 * 1024 * 1024,
  MESSAGE_ATTACHMENT: 10 * 1024 * 1024,
} as const;

/**
 * Per-entity image count caps. See storage-strategy.md §7.
 */
export const IMAGE_COUNT_LIMITS = {
  OFFERING: 5,
  COMMUNITY: 10,
  COMMUNITY_POST: 4,
  MESSAGE_ATTACHMENT: 10,
} as const;
