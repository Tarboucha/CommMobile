import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertPostAuthor } from "@/lib/guards/assert-post-author";
import { signImageUploadSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/community-posts/{postId}/image/sign
 * Returns a presigned URL for uploading an image to a community post.
 * Only the post's author can attach an image.
 */
export const POST = withAuth<{ postId: string }>(async (user, request: NextRequest, params) => {
  try {
    const post = await assertPostAuthor(params!.postId, user.id);
    const input = await parseJsonBody(request, signImageUploadSchema);
    const presigned = await storageService.signCommunityPostImageUpload(
      { id: post.id, community_id: post.community_id },
      { filename: input.filename, contentType: input.content_type }
    );
    return successResponse(presigned);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
