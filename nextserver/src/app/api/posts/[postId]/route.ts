import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { updatePostSchema } from "@/lib/validations/post";

/**
 * GET /api/posts/[postId]
 * Get single post
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const postId = params?.postId;
  if (!postId) {
    return ApiErrors.badRequest("Post ID is required");
  }

  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("community_posts")
    .select("*, profiles!author_id(id, first_name, last_name, avatar_url)")
    .eq("id", postId)
    .is("deleted_at", null)
    .single();

  if (error || !post) {
    return ApiErrors.notFound("Post");
  }

  return successResponse({ post });
});

/**
 * PATCH /api/posts/[postId]
 * Update post — author only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const postId = params?.postId;
  if (!postId) {
    return ApiErrors.badRequest("Post ID is required");
  }

  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return ApiErrors.notFound("Post");
  }

  if (existing.author_id !== user.id) {
    return ApiErrors.forbidden("You can only edit your own posts");
  }

  // Parse and validate
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updatePostSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { data: post, error: updateError } = await supabase
    .from("community_posts")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*, profiles!author_id(id, first_name, last_name, avatar_url)")
    .single();

  if (updateError || !post) {
    console.error("Failed to update post:", updateError);
    return ApiErrors.serverError();
  }

  return successResponse({ post });
});

/**
 * DELETE /api/posts/[postId]
 * Soft delete post — author only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const postId = params?.postId;
  if (!postId) {
    return ApiErrors.badRequest("Post ID is required");
  }

  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return ApiErrors.notFound("Post");
  }

  if (existing.author_id !== user.id) {
    return ApiErrors.forbidden("You can only delete your own posts");
  }

  const { error } = await supabase
    .from("community_posts")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive",
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to delete post:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ deleted: true });
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
