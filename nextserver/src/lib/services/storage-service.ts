/**
 * Storage service — business-level operations for image uploads.
 *
 * Route handlers run auth guards and delegate here. This service:
 *   - enforces per-entity image count caps
 *   - builds R2 object keys via the paths helper
 *   - mints presigned URLs via the presign helper
 *   - creates/deletes DB rows (offering_images, communities, etc.)
 *   - coordinates R2 DeleteObject calls on deletion
 *
 * Transport-agnostic: throws domain errors, never NextResponse.
 */

import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET } from "@/lib/storage/s3";
import {
  avatarKey,
  offeringImageKey,
  communityImageKey,
  communityPostImageKey,
  messageAttachmentKey,
  generateFilename,
  keyHasPrefix,
  STORAGE_PREFIXES,
} from "@/lib/storage/paths";
import { presignUpload, type PresignedUpload } from "@/lib/storage/presign";
import {
  FILE_SIZE_LIMITS,
  IMAGE_COUNT_LIMITS,
  isAllowedImageType,
} from "@/lib/storage/mime";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/errors/domain-errors";

// ─── Input types ────────────────────────────────────────────────────────────

export interface SignInput {
  filename: string;          // original filename (for extension detection)
  contentType: string;       // MIME type from the client
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileExtensionFor(contentType: string, filename: string): string {
  // Prefer content-type → extension mapping; fall back to the original.
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return filename.split(".").pop()?.toLowerCase() || "jpg";
  }
}

async function deleteR2Object(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    // Best effort. Orphan-sweep will clean it up if this fails.
    console.warn(`[storage] R2 delete failed for ${key}:`, err);
  }
}

/**
 * HEAD-check an uploaded R2 object before committing a DB row.
 *
 * Signed PUT URLs can't enforce a max size (S3 signs exact Content-Length,
 * not a range), so a malicious client could upload a file much larger than
 * the per-entity cap. This verifies the object exists and is within limits;
 * if it's oversize we delete it before throwing so we don't leave orphans.
 *
 * Throws ValidationError on any problem — object missing, size unknown,
 * or size over cap.
 */
async function verifyUploadedObject(key: string, maxBytes: number): Promise<void> {
  let size: number | undefined;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    size = head.ContentLength;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404) {
      throw new ValidationError("Uploaded file not found at the expected key");
    }
    throw err;
  }

  if (size === undefined) {
    await deleteR2Object(key);
    throw new ValidationError("Uploaded file size could not be determined");
  }
  if (size > maxBytes) {
    await deleteR2Object(key);
    throw new ValidationError(
      `Uploaded file is ${size} bytes, exceeds limit of ${maxBytes} bytes`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//   AVATAR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sign an avatar upload. The caller has already verified user owns profileId.
 * The key includes a fresh UUID so each upload is idempotent on the R2 side.
 */
export async function signAvatarUpload(
  profileId: string,
  input: SignInput
): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }
  const filename = generateFilename(fileExtensionFor(input.contentType, input.filename));
  return presignUpload({
    key: avatarKey(profileId, filename),
    contentType: input.contentType,
    maxBytes: FILE_SIZE_LIMITS.AVATAR,
  });
}

/**
 * Atomic avatar replacement. See storage-strategy.md §8.
 *   1. SELECT old avatar_url
 *   2. UPDATE profiles SET avatar_url = new_key   ← DB now points at new file
 *   3. best-effort delete old R2 object
 *
 * Fails cleanly if the new key doesn't belong to this profile's prefix.
 */
export async function replaceAvatar(profileId: string, key: string) {
  if (!keyHasPrefix(key, STORAGE_PREFIXES.PROFILE_AVATARS)) {
    throw new ValidationError("Invalid avatar key prefix");
  }
  if (!key.startsWith(`${STORAGE_PREFIXES.PROFILE_AVATARS}/${profileId}/`)) {
    throw new ValidationError("Avatar key does not belong to this profile");
  }

  await verifyUploadedObject(key, FILE_SIZE_LIMITS.AVATAR);

  const existing = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { avatar_url: true },
  });
  if (!existing) throw new NotFoundError("Profile");

  const updated = await prisma.profiles.update({
    where: { id: profileId },
    data: { avatar_url: key },
  });

  if (existing.avatar_url && existing.avatar_url !== key) {
    await deleteR2Object(existing.avatar_url);
  }

  return updated;
}

/**
 * Clear the avatar_url on a profile and best-effort delete the R2 object.
 * Caller must have verified the user is allowed to mutate this profile.
 */
export async function clearAvatar(profileId: string) {
  const existing = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { avatar_url: true },
  });
  if (!existing) throw new NotFoundError("Profile");

  await prisma.profiles.update({
    where: { id: profileId },
    data: { avatar_url: null },
  });

  if (existing.avatar_url) {
    await deleteR2Object(existing.avatar_url);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//   OFFERING IMAGES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sign an offering image upload. Caller must have verified user owns
 * the offering.
 *
 * Refuses when the offering already has IMAGE_COUNT_LIMITS.OFFERING images —
 * saves an upload that would be rejected at persist time anyway.
 */
export async function signOfferingImageUpload(
  offering: { id: string; provider_id: string },
  input: SignInput
): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }

  const count = await prisma.offering_images.count({
    where: { offering_id: offering.id },
  });
  if (count >= IMAGE_COUNT_LIMITS.OFFERING) {
    throw new ConflictError(
      `Offering already has the maximum of ${IMAGE_COUNT_LIMITS.OFFERING} images`
    );
  }

  const filename = generateFilename(fileExtensionFor(input.contentType, input.filename));
  return presignUpload({
    key: offeringImageKey(offering.provider_id, offering.id, filename),
    contentType: input.contentType,
    maxBytes: FILE_SIZE_LIMITS.OFFERING_IMAGE,
  });
}

/**
 * Persist an offering image row after a successful R2 upload.
 *
 * The key must belong to this offering's provider/offering path — prevents
 * a caller from reusing a key uploaded under a different offering.
 */
export async function persistOfferingImage(
  offering: { id: string; provider_id: string },
  opts: { key: string; makePrimary?: boolean }
) {
  if (!keyHasPrefix(opts.key, STORAGE_PREFIXES.OFFERING_IMAGES)) {
    throw new ValidationError("Invalid offering-image key prefix");
  }
  if (!opts.key.startsWith(
    `${STORAGE_PREFIXES.OFFERING_IMAGES}/${offering.provider_id}/${offering.id}/`
  )) {
    throw new ValidationError("Key does not belong to this offering");
  }

  const count = await prisma.offering_images.count({
    where: { offering_id: offering.id },
  });
  if (count >= IMAGE_COUNT_LIMITS.OFFERING) {
    throw new ConflictError(
      `Offering already has the maximum of ${IMAGE_COUNT_LIMITS.OFFERING} images`
    );
  }

  await verifyUploadedObject(opts.key, FILE_SIZE_LIMITS.OFFERING_IMAGE);

  // First image auto-becomes primary unless caller explicitly opts out.
  const isPrimary = opts.makePrimary ?? count === 0;

  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      // Only one primary per offering — partial unique index enforces, but we
      // unset the old primary here to avoid the insert failing.
      await tx.offering_images.updateMany({
        where: { offering_id: offering.id, is_primary: true },
        data: { is_primary: false },
      });
    }
    return tx.offering_images.create({
      data: {
        offering_id: offering.id,
        image_url: opts.key,
        is_primary: isPrimary,
        display_order: count,
      },
    });
  });
}

/**
 * Delete an offering image row + its R2 object.
 * Caller has already verified offering ownership.
 */
export async function deleteOfferingImage(
  offering: { id: string; provider_id: string },
  imageId: string
) {
  const image = await prisma.offering_images.findFirst({
    where: { id: imageId, offering_id: offering.id },
  });
  if (!image) throw new NotFoundError("Offering image");

  await prisma.offering_images.delete({ where: { id: imageId } });
  await deleteR2Object(image.image_url);

  // If we just deleted the primary, promote the oldest remaining image.
  if (image.is_primary) {
    const next = await prisma.offering_images.findFirst({
      where: { offering_id: offering.id },
      orderBy: { created_at: "asc" },
    });
    if (next) {
      await prisma.offering_images.update({
        where: { id: next.id },
        data: { is_primary: true },
      });
    }
  }

  return { deleted: true };
}

/**
 * List all images for an offering (ordered by display_order, primary first).
 */
export async function listOfferingImages(offeringId: string) {
  return prisma.offering_images.findMany({
    where: { offering_id: offeringId },
    orderBy: [{ is_primary: "desc" }, { display_order: "asc" }, { created_at: "asc" }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//   COMMUNITY IMAGE (single image per community, atomic replace)
// ═══════════════════════════════════════════════════════════════════════════

export async function signCommunityImageUpload(
  communityId: string,
  input: SignInput
): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }
  const filename = generateFilename(fileExtensionFor(input.contentType, input.filename));
  return presignUpload({
    key: communityImageKey(communityId, filename),
    contentType: input.contentType,
    maxBytes: FILE_SIZE_LIMITS.COMMUNITY_IMAGE,
  });
}

/**
 * Atomic community image replacement. Same pattern as avatar.
 */
export async function replaceCommunityImage(communityId: string, key: string) {
  if (!keyHasPrefix(key, STORAGE_PREFIXES.COMMUNITY_IMAGES)) {
    throw new ValidationError("Invalid community-image key prefix");
  }
  if (!key.startsWith(`${STORAGE_PREFIXES.COMMUNITY_IMAGES}/${communityId}/`)) {
    throw new ValidationError("Community image key does not belong to this community");
  }

  await verifyUploadedObject(key, FILE_SIZE_LIMITS.COMMUNITY_IMAGE);

  const existing = await prisma.communities.findUnique({
    where: { id: communityId },
    select: { community_image_url: true },
  });
  if (!existing) throw new NotFoundError("Community");

  const updated = await prisma.communities.update({
    where: { id: communityId },
    data: { community_image_url: key },
  });

  if (existing.community_image_url && existing.community_image_url !== key) {
    await deleteR2Object(existing.community_image_url);
  }

  return updated;
}

export async function clearCommunityImage(communityId: string) {
  const existing = await prisma.communities.findUnique({
    where: { id: communityId },
    select: { community_image_url: true },
  });
  if (!existing) throw new NotFoundError("Community");

  await prisma.communities.update({
    where: { id: communityId },
    data: { community_image_url: null },
  });

  if (existing.community_image_url) {
    await deleteR2Object(existing.community_image_url);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//   COMMUNITY POST IMAGE (single image per post, atomic replace)
// ═══════════════════════════════════════════════════════════════════════════

export async function signCommunityPostImageUpload(
  post: { id: string; community_id: string },
  input: SignInput
): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }
  const filename = generateFilename(fileExtensionFor(input.contentType, input.filename));
  return presignUpload({
    key: communityPostImageKey(post.community_id, post.id, filename),
    contentType: input.contentType,
    maxBytes: FILE_SIZE_LIMITS.COMMUNITY_POST_IMAGE,
  });
}

export async function replaceCommunityPostImage(
  post: { id: string; community_id: string },
  key: string
) {
  if (!keyHasPrefix(key, STORAGE_PREFIXES.COMMUNITY_POST_IMAGES)) {
    throw new ValidationError("Invalid community-post-image key prefix");
  }
  if (!key.startsWith(`${STORAGE_PREFIXES.COMMUNITY_POST_IMAGES}/${post.community_id}/${post.id}/`)) {
    throw new ValidationError("Key does not belong to this post");
  }

  await verifyUploadedObject(key, FILE_SIZE_LIMITS.COMMUNITY_POST_IMAGE);

  const existing = await prisma.community_posts.findUnique({
    where: { id: post.id },
    select: { image_url: true },
  });
  if (!existing) throw new NotFoundError("Community post");

  const updated = await prisma.community_posts.update({
    where: { id: post.id },
    data: { image_url: key },
  });

  if (existing.image_url && existing.image_url !== key) {
    await deleteR2Object(existing.image_url);
  }

  return updated;
}

export async function clearCommunityPostImage(postId: string) {
  const existing = await prisma.community_posts.findUnique({
    where: { id: postId },
    select: { image_url: true },
  });
  if (!existing) throw new NotFoundError("Community post");

  await prisma.community_posts.update({
    where: { id: postId },
    data: { image_url: null },
  });

  if (existing.image_url) {
    await deleteR2Object(existing.image_url);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//   MESSAGE ATTACHMENTS (many per message, sender-only, 72h TTL)
//   TTL expiration is handled by the worker's expire-attachments job.
// ═══════════════════════════════════════════════════════════════════════════

export async function signMessageAttachmentUpload(
  message: { id: string; conversation_id: string },
  input: SignInput
): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }

  const count = await prisma.message_attachments.count({
    where: { message_id: message.id },
  });
  if (count >= IMAGE_COUNT_LIMITS.MESSAGE_ATTACHMENT) {
    throw new ConflictError(
      `Message already has the maximum of ${IMAGE_COUNT_LIMITS.MESSAGE_ATTACHMENT} attachments`
    );
  }

  const filename = generateFilename(fileExtensionFor(input.contentType, input.filename));
  return presignUpload({
    key: messageAttachmentKey(message.conversation_id, message.id, filename),
    contentType: input.contentType,
    maxBytes: FILE_SIZE_LIMITS.MESSAGE_ATTACHMENT,
  });
}

export async function persistMessageAttachment(
  message: { id: string; conversation_id: string },
  opts: {
    key: string;
    file_name?: string;
    mime_type?: string;
    file_size_bytes?: number;
    width?: number;
    height?: number;
  }
) {
  if (!keyHasPrefix(opts.key, STORAGE_PREFIXES.MESSAGE_ATTACHMENTS)) {
    throw new ValidationError("Invalid message-attachment key prefix");
  }
  if (!opts.key.startsWith(
    `${STORAGE_PREFIXES.MESSAGE_ATTACHMENTS}/${message.conversation_id}/${message.id}/`
  )) {
    throw new ValidationError("Key does not belong to this message");
  }

  const count = await prisma.message_attachments.count({
    where: { message_id: message.id },
  });
  if (count >= IMAGE_COUNT_LIMITS.MESSAGE_ATTACHMENT) {
    throw new ConflictError(
      `Message already has the maximum of ${IMAGE_COUNT_LIMITS.MESSAGE_ATTACHMENT} attachments`
    );
  }

  await verifyUploadedObject(opts.key, FILE_SIZE_LIMITS.MESSAGE_ATTACHMENT);

  // expires_at defaults to `now() + 72 hours` via DB column default.
  return prisma.message_attachments.create({
    data: {
      message_id: message.id,
      file_url: opts.key,
      file_name: opts.file_name,
      mime_type: opts.mime_type,
      file_size_bytes: opts.file_size_bytes,
      width: opts.width,
      height: opts.height,
    },
  });
}

export async function deleteMessageAttachment(attachmentId: string) {
  const attachment = await prisma.message_attachments.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) throw new NotFoundError("Message attachment");

  await prisma.message_attachments.delete({ where: { id: attachmentId } });
  await deleteR2Object(attachment.file_url);

  return { deleted: true };
}

export async function listMessageAttachments(messageId: string) {
  return prisma.message_attachments.findMany({
    where: { message_id: messageId },
    orderBy: { created_at: "asc" },
  });
}
