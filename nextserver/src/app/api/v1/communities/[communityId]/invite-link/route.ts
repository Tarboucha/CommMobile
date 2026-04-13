import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as communityService from "@/lib/services/community-service";

/**
 * POST /api/communities/[communityId]/invite-link
 * Generate or refresh the community invite link (admin/owner/moderator only)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  try {
    const result = await communityService.generateInviteLink(
      params!.communityId,
      user.id
    );
    return successResponse(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/communities/[communityId]/invite-link
 * Revoke the community invite link (admin/owner/moderator only)
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await communityService.revokeInviteLink(params!.communityId, user.id);
    return successResponse({ message: "Invite link revoked" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}
