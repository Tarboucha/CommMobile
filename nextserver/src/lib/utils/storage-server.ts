/**
 * Server-side Storage Utilities — Cloudflare R2 (S3-compatible)
 *
 * All files go into a single R2 bucket, organized by prefix:
 *   profile-avatars/{profileId}/{filename}
 *   offering-images/{providerId}/{offeringId}/{filename}
 *   community-images/{communityId}/{filename}
 *   message-attachments/{conversationId}/{messageId}/{filename}
 */

import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// ─── S3 Client (Cloudflare R2) ──────────────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET || "kodo-assets";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT;

// ─── Storage prefixes (act as virtual "buckets" inside one R2 bucket) ───────

export const STORAGE_BUCKETS = {
  OFFERING_IMAGES: "offering-images",
  PROFILE_AVATARS: "profile-avatars",
  COMMUNITY_IMAGES: "community-images",
  MESSAGE_ATTACHMENTS: "message-attachments",
} as const;

export const FILE_SIZE_LIMITS = {
  OFFERING_IMAGE: 5 * 1024 * 1024,
  AVATAR: 5 * 1024 * 1024,
  COMMUNITY_IMAGE: 5 * 1024 * 1024,
  MESSAGE_ATTACHMENT: 10 * 1024 * 1024,
} as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

// ─── Path builders ──────────────────────────────────────────────────────────

export function generateImageIdAndFilename(
  originalName: string
): { id: string; filename: string } {
  const id = randomUUID();
  const extension = originalName.split(".").pop()?.toLowerCase() || "jpg";
  return { id, filename: `${id}.${extension}` };
}

export function buildOfferingImagePath(
  providerId: string,
  offeringId: string,
  filename: string
): string {
  return `${providerId}/${offeringId}/${filename}`;
}

export function buildAvatarPath(profileId: string, filename: string): string {
  return `${profileId}/${filename}`;
}

export function buildCommunityImagePath(
  communityId: string,
  filename: string
): string {
  return `${communityId}/${filename}`;
}

export function buildMessageAttachmentPath(
  conversationId: string,
  messageId: string,
  filename: string
): string {
  return `${conversationId}/${messageId}/${filename}`;
}

// ─── Upload / Delete / List ─────────────────────────────────────────────────

export async function uploadToStorage(
  prefix: string,
  path: string,
  fileBuffer: Buffer | ArrayBuffer,
  contentType: string
): Promise<string | null> {
  try {
    const buffer =
      fileBuffer instanceof ArrayBuffer ? Buffer.from(fileBuffer) : fileBuffer;
    const key = `${prefix}/${path}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return key;
  } catch (error) {
    console.error(`[Storage] Upload failed for ${prefix}/${path}:`, error);
    return null;
  }
}

export async function deleteFromStorage(
  prefix: string,
  path: string
): Promise<boolean> {
  try {
    const key = `${prefix}/${path}`;
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error(`[Storage] Delete failed for ${prefix}/${path}:`, error);
    return false;
  }
}

export async function listFiles(
  prefix: string,
  folder: string
): Promise<string[]> {
  try {
    const fullPrefix = `${prefix}/${folder}/`;
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: fullPrefix,
      })
    );
    return (result.Contents || []).map((obj: { Key?: string }) => obj.Key!).filter(Boolean);
  } catch (error) {
    console.error(`[Storage] List failed for ${prefix}/${folder}:`, error);
    return [];
  }
}

export async function deleteByKey(key: string): Promise<boolean> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    console.error(`[Storage] Delete failed for ${key}:`, error);
    return false;
  }
}

// ─── URL helpers ────────────────────────────────────────────────────────────

export function getPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath || typeof storagePath !== "string") return null;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  return `${PUBLIC_URL}/${storagePath}`;
}

export function extractStorageInfo(
  storagePath: string | null | undefined
): { bucket: string; path: string } | null {
  if (!storagePath || typeof storagePath !== "string") return null;
  const parts = storagePath.split("/");
  if (parts.length < 2) return null;
  return { bucket: parts[0], path: parts.slice(1).join("/") };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export async function validateImageFile(
  file: File,
  maxSizeBytes: number = FILE_SIZE_LIMITS.OFFERING_IMAGE
): Promise<{ valid: boolean; error?: string }> {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }
  return { valid: true };
}

export async function parseFormDataWithFile(
  request: Request
): Promise<{
  fields: Record<string, string | boolean | number>;
  file: File | null;
  error?: string;
}> {
  try {
    const formData = await request.formData();
    const fields: Record<string, any> = {};
    let file: File | null = null;

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        if (file) {
          return { fields: {}, file: null, error: "Multiple files not allowed" };
        }
        file = value;
      } else {
        if (value === "true" || value === "false") {
          fields[key] = value === "true";
        } else if (!isNaN(Number(value)) && value !== "") {
          fields[key] = Number(value);
        } else {
          fields[key] = value;
        }
      }
    }

    return { fields, file };
  } catch (error) {
    return {
      fields: {},
      file: null,
      error: error instanceof Error ? error.message : "Failed to parse form data",
    };
  }
}
