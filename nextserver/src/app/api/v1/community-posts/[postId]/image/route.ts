import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertPostAuthor } from "@/lib/guards/assert-post-author";
import { createImageFromKeySchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/community-posts/{postId}/image
 * Attach / replace an image on a post. Body: { key }.
 */
export const POST = withAuth<{ postId: string }>(async (user, request: NextRequest, params) => {
  try {
    const post = await assertPostAuthor(params!.postId, user.id);
    const input = await parseJsonBody(request, createImageFromKeySchema);
    const updated = await storageService.replaceCommunityPostImage(
      { id: post.id, community_id: post.community_id },
      input.key
    );
    return successResponse({ post: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/v1/community-posts/{postId}/image
 * Remove the post's image (DB + R2).
 */
export const DELETE = withAuth<{ postId: string }>(async (user, _request, params) => {
  try {
    const post = await assertPostAuthor(params!.postId, user.id);
    await storageService.clearCommunityPostImage(post.id);
    return successResponse({ message: "Post image removed" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST", "DELETE"]); }
