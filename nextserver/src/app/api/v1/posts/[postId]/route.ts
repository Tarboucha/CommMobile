import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { updatePostSchema } from "@/lib/validations/post";

/**
 * GET /api/posts/[postId]
 * Get single post
 */
export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  const postId = params?.postId;
  if (!postId) {
    return ApiErrors.badRequest("Post ID is required");
  }

  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
    },
  });

  if (!post) {
    return ApiErrors.notFound("Post");
  }

  return successResponse({ post: post });
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

  const existing = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, author_id: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Post");
  }

  if (existing.author_id !== user.id) {
    return ApiErrors.forbidden("You can only edit your own posts");
  }

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

  try {
    const post = await prisma.community_posts.update({
      where: { id: postId },
      data: { ...validation.data, updated_at: new Date() },
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
    });

    return successResponse({ post: post });
  } catch (error) {
    console.error("Failed to update post:", error);
    return ApiErrors.serverError();
  }
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

  const existing = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, author_id: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Post");
  }

  if (existing.author_id !== user.id) {
    return ApiErrors.forbidden("You can only delete your own posts");
  }

  try {
    await prisma.community_posts.update({
      where: { id: postId },
      data: { deleted_at: new Date(), status: "inactive" },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return ApiErrors.serverError();
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
