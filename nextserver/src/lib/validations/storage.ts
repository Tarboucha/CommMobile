import { z } from "zod";
import { ALLOWED_IMAGE_TYPES } from "@/lib/storage/mime";

/**
 * Body shape for all "sign an image upload" endpoints.
 * Resource-specific rules (count caps, ownership) live in the service.
 */
export const signImageUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  content_type: z.enum([...ALLOWED_IMAGE_TYPES] as [string, ...string[]]),
});

export const createImageFromKeySchema = z.object({
  key: z.string().min(1).max(512),
  make_primary: z.boolean().optional(),
});

/** Extra metadata passed when persisting a message attachment. */
export const createMessageAttachmentSchema = z.object({
  key: z.string().min(1).max(512),
  file_name: z.string().max(255).optional(),
  mime_type: z.string().max(100).optional(),
  file_size_bytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
