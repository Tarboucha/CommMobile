import { randomUUID } from "crypto";

/**
 * Centralized R2 key scheme. Reorganize the bucket by touching this file only.
 *
 * Convention: every key starts with an entity-kind prefix followed by
 * "ownership path" components (who/what). Filenames are UUID-based to avoid
 * collisions and path-traversal hazards.
 */

export const STORAGE_PREFIXES = {
  PROFILE_AVATARS: "profile-avatars",
  OFFERING_IMAGES: "offering-images",
  COMMUNITY_IMAGES: "community-images",
  COMMUNITY_POST_IMAGES: "community-posts",
  MESSAGE_ATTACHMENTS: "message-attachments",
} as const;

export type StoragePrefix = (typeof STORAGE_PREFIXES)[keyof typeof STORAGE_PREFIXES];

// ─── Filename generation ─────────────────────────────────────────────────────

/**
 * Generate a UUID-based filename. All uploads end up as `.jpg` because the
 * mobile client re-encodes to JPEG before upload (see storage-strategy.md §3).
 */
export function generateFilename(extension = "jpg"): string {
  return `${randomUUID()}.${extension.replace(/^\./, "")}`;
}

// ─── Key builders ────────────────────────────────────────────────────────────

export function avatarKey(profileId: string, filename: string): string {
  return `${STORAGE_PREFIXES.PROFILE_AVATARS}/${profileId}/${filename}`;
}

export function offeringImageKey(
  providerId: string,
  offeringId: string,
  filename: string
): string {
  return `${STORAGE_PREFIXES.OFFERING_IMAGES}/${providerId}/${offeringId}/${filename}`;
}

export function communityImageKey(communityId: string, filename: string): string {
  return `${STORAGE_PREFIXES.COMMUNITY_IMAGES}/${communityId}/${filename}`;
}

export function communityPostImageKey(
  communityId: string,
  postId: string,
  filename: string
): string {
  return `${STORAGE_PREFIXES.COMMUNITY_POST_IMAGES}/${communityId}/${postId}/${filename}`;
}

export function messageAttachmentKey(
  conversationId: string,
  messageId: string,
  filename: string
): string {
  return `${STORAGE_PREFIXES.MESSAGE_ATTACHMENTS}/${conversationId}/${messageId}/${filename}`;
}

// ─── Key validation ──────────────────────────────────────────────────────────

/**
 * Verify a key starts with the expected prefix. Use when a client posts a
 * "key" they claim to have uploaded — prevents cross-entity key hijacking.
 */
export function keyHasPrefix(key: string, prefix: StoragePrefix): boolean {
  return key.startsWith(`${prefix}/`);
}
