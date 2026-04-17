import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { createImageFromKeySchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/communities/{communityId}/image
 * Persist a newly-uploaded community image. Atomically replaces the previous one.
 * Body: { key }
 */
export const POST = withAuth<{ communityId: string }>(async (user, request: NextRequest, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id, {
      requiredRoles: ["owner", "admin"],
    });
    const input = await parseJsonBody(request, createImageFromKeySchema);
    const community = await storageService.replaceCommunityImage(params!.communityId, input.key);
    return successResponse({ community });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/v1/communities/{communityId}/image
 * Clear the community image (DB + R2).
 */
export const DELETE = withAuth<{ communityId: string }>(async (user, _request, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id, {
      requiredRoles: ["owner", "admin"],
    });
    await storageService.clearCommunityImage(params!.communityId);
    return successResponse({ message: "Community image removed" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST", "DELETE"]); }
