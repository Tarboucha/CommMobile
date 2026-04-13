import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { updatePostSchema } from "@/lib/validations/post";
import * as postService from "@/lib/services/post-service";

/**
 * GET /api/posts/[postId]
 * Get single post
 */
export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  try {
    const post = await postService.getPost(params!.postId);
    return successResponse({ post });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * PATCH /api/posts/[postId]
 * Update post — author only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const data = await parseJsonBody(request, updatePostSchema);
    const post = await postService.updatePost(params!.postId, user.id, data);
    return successResponse({ post });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/posts/[postId]
 * Soft delete post — author only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await postService.deletePost(params!.postId, user.id);
    return successResponse({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
