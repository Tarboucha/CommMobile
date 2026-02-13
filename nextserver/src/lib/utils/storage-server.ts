/**
 * Server-side Storage Utilities
 * Provides utilities for Supabase Storage operations (upload, delete, path building)
 *
 * This file uses server-only imports and should NOT be imported in client components.
 */

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  OFFERING_IMAGES: "offering-images",
  PROFILE_AVATARS: "profile-avatars",
  COMMUNITY_IMAGES: "community-images",
  MESSAGE_ATTACHMENTS: "message-attachments",
} as const;

/**
 * File size limits in bytes
 */
export const FILE_SIZE_LIMITS = {
  OFFERING_IMAGE: 5 * 1024 * 1024, // 5MB
  AVATAR: 5 * 1024 * 1024, // 5MB
  COMMUNITY_IMAGE: 5 * 1024 * 1024, // 5MB
  MESSAGE_ATTACHMENT: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/**
 * Generate UUID and filename for image upload
 *
 * @param originalName - Original filename from upload
 * @returns Object with UUID (id) and filename (uuid.extension)
 */
export function generateImageIdAndFilename(
  originalName: string
): { id: string; filename: string } {
  const id = randomUUID();
  const extension = originalName.split(".").pop()?.toLowerCase() || "jpg";
  return {
    id,
    filename: `${id}.${extension}`,
  };
}

/**
 * Build storage path for offering images
 *
 * @param providerId - Provider profile ID
 * @param offeringId - Offering ID
 * @param filename - Filename (should include UUID)
 * @returns Storage path: `provider-id/offering-id/filename`
 */
export function buildOfferingImagePath(
  providerId: string,
  offeringId: string,
  filename: string
): string {
  return `${providerId}/${offeringId}/${filename}`;
}

/**
 * Build storage path for profile avatars
 *
 * @param profileId - Profile ID
 * @param filename - Filename
 * @returns Storage path: `profile-id/filename`
 */
export function buildAvatarPath(profileId: string, filename: string): string {
  return `${profileId}/${filename}`;
}

/**
 * Build storage path for community images (logo, banner)
 *
 * @param communityId - Community ID
 * @param filename - Filename
 * @returns Storage path: `community-id/filename`
 */
export function buildCommunityImagePath(
  communityId: string,
  filename: string
): string {
  return `${communityId}/${filename}`;
}

/**
 * Build storage path for message attachments
 *
 * @param conversationId - Conversation ID
 * @param messageId - Message ID
 * @param filename - Filename
 * @returns Storage path: `conversation-id/message-id/filename`
 */
export function buildMessageAttachmentPath(
  conversationId: string,
  messageId: string,
  filename: string
): string {
  return `${conversationId}/${messageId}/${filename}`;
}

/**
 * Upload file to Supabase Storage
 *
 * @param bucket - Storage bucket name
 * @param path - Storage path (relative to bucket)
 * @param fileBuffer - File buffer to upload
 * @param contentType - MIME type of the file
 * @returns Full storage path: `bucket/path` or null on failure
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  fileBuffer: Buffer | ArrayBuffer,
  contentType: string
): Promise<string | null> {
  try {
    const supabase = await createClient();

    // Convert ArrayBuffer to Buffer if needed
    const buffer =
      fileBuffer instanceof ArrayBuffer ? Buffer.from(fileBuffer) : fileBuffer;

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error(`[Storage] Upload failed for ${bucket}/${path}:`, error);
      return null;
    }

    return `${bucket}/${path}`;
  } catch (error) {
    console.error(`[Storage] Upload error for ${bucket}/${path}:`, error);
    return null;
  }
}

/**
 * Delete file from Supabase Storage
 *
 * @param bucket - Storage bucket name
 * @param path - Storage path (relative to bucket)
 * @returns true if successful, false otherwise
 */
export async function deleteFromStorage(
  bucket: string,
  path: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error(`[Storage] Delete failed for ${bucket}/${path}:`, error);
      return false;
    }

    if (data && Array.isArray(data) && data.length > 0) {
      return true;
    }

    // Empty array or no data - file might not exist
    console.warn(
      `[Storage] Delete returned empty for ${bucket}/${path} - file may not exist`
    );
    return false;
  } catch (error) {
    console.error(`[Storage] Delete error for ${bucket}/${path}:`, error);
    return false;
  }
}

/**
 * Extract bucket and path from full storage path
 *
 * @param storagePath - Full storage path: `bucket/path/to/file.jpg`
 * @returns Object with bucket and path, or null if invalid
 */
export function extractStorageInfo(
  storagePath: string | null | undefined
): { bucket: string; path: string } | null {
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  const parts = storagePath.split("/");
  if (parts.length < 2) {
    return null;
  }

  const bucket = parts[0];
  const path = parts.slice(1).join("/");

  return { bucket, path };
}

/**
 * Validate image file (size and MIME type)
 *
 * @param file - File object to validate
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns Validation result with valid flag and optional error message
 */
export async function validateImageFile(
  file: File,
  maxSizeBytes: number = FILE_SIZE_LIMITS.OFFERING_IMAGE
): Promise<{ valid: boolean; error?: string }> {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Parse multipart/form-data request and separate file from fields
 *
 * @param request - Request object with FormData
 * @returns Object with parsed fields and file, or error
 */
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
          return {
            fields: {},
            file: null,
            error: "Multiple files not allowed",
          };
        }
        file = value;
      } else {
        // Parse boolean strings
        if (value === "true" || value === "false") {
          fields[key] = value === "true";
        }
        // Parse numbers
        else if (!isNaN(Number(value)) && value !== "") {
          fields[key] = Number(value);
        }
        // Keep as string
        else {
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

/**
 * Convert storage path to public CDN URL
 *
 * @param storagePath - Storage path: `bucket/path/to/file.jpg`
 * @returns Full CDN URL or null if invalid
 */
export function getPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  // If already a full URL, return as-is
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("[Storage] NEXT_PUBLIC_SUPABASE_URL is not set");
    return null;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/public/${storagePath}`;
}
