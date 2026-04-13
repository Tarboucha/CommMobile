import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors, parseZodError } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { createPostSchema } from "@/lib/validations/post";
import { paginationSchema } from "@/lib/validations/pagination";
import * as postService from "@/lib/services/post-service";

/**
 * GET /api/communities/[communityId]/posts
 * List community posts
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  try {
    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = paginationSchema.safeParse(searchParams);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    const result = await postService.listCommunityPosts(
      params!.communityId,
      validation.data
    );
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/communities/[communityId]/posts
 * Create a new post — requires owner or admin role
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    const data = await parseJsonBody(request, createPostSchema);
    const post = await postService.createCommunityPost(
      params!.communityId,
      user.id,
      data
    );
    return successResponse({ post }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
