import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { createImageFromKeySchema } from "@/lib/validations/storage";
import * as profileService from "@/lib/services/profile-service";
import * as storageService from "@/lib/services/storage-service";

/**
 * GET /api/v1/profiles/{profileId}/avatar
 * Get current avatar URL for a profile.
 */
export const GET = withAuth<{ profileId: string }>(async (user, _request, params) => {
  try {
    const result = await profileService.getAvatar(params!.profileId, user.id);
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/v1/profiles/{profileId}/avatar
 * Persist a newly-uploaded avatar by R2 key. Atomically replaces the
 * previous avatar (see storage-strategy.md §8).
 *
 * Body: { key }
 */
export const POST = withAuth<{ profileId: string }>(async (user, request: NextRequest, params) => {
  try {
    if (user.id !== params!.profileId) {
      return ApiErrors.forbidden("You can only update your own profile");
    }
    const input = await parseJsonBody(request, createImageFromKeySchema);
    const profile = await storageService.replaceAvatar(params!.profileId, input.key);
    return successResponse({ profile });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/v1/profiles/{profileId}/avatar
 * Clear the avatar and delete the R2 object (best effort).
 */
export const DELETE = withAuth<{ profileId: string }>(async (user, _request, params) => {
  try {
    if (user.id !== params!.profileId) {
      return ApiErrors.forbidden("You can only delete your own avatar");
    }
    await storageService.clearAvatar(params!.profileId);
    return successResponse({ message: "Avatar deleted" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST", "DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST", "DELETE"]); }
