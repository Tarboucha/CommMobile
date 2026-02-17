import { z } from "zod";
import { paginationSchema } from "@/lib/validations/pagination";

// ============================================================================
// Post Schemas
// ============================================================================

export const createPostSchema = z.object({
  body: z.string().min(1, "Post body is required").max(5000),
  image_url: z.string().url("Invalid image URL").optional().nullable(),
  link_url: z.string().url("Invalid link URL").optional().nullable(),
});

export const updatePostSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  image_url: z.string().url().optional().nullable(),
  link_url: z.string().url().optional().nullable(),
});

// ============================================================================
// Pin Schemas
// ============================================================================

export const pinItemSchema = z.object({
  item_type: z.enum(["offering", "post"]),
  item_id: z.string().uuid("Invalid item ID"),
});

// ============================================================================
// Board Filter Schema
// ============================================================================

export const boardFilterSchema = paginationSchema;

// ============================================================================
// Type exports
// ============================================================================

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PinItemInput = z.infer<typeof pinItemSchema>;
