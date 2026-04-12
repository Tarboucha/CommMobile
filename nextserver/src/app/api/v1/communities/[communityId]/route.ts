import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { updateCommunitySchema } from "@/lib/validations/community";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as communityService from "@/lib/services/community-service";

/**
 * GET /api/communities/[communityId]
 * Get a single community
 */
export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  try {
    const community = await communityService.getCommunity(params!.communityId);
    return successResponse({ community });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * PATCH /api/communities/[communityId]
 * Update community — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, updateCommunitySchema);
    const updated = await communityService.updateCommunity(
      params!.communityId,
      user.id,
      input
    );
    return successResponse({ community: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/communities/[communityId]
 * Soft delete — owner only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await communityService.deleteCommunity(params!.communityId, user.id);
    return successResponse({ message: "Community deleted" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
