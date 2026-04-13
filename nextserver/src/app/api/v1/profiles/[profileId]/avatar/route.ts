import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as profileService from "@/lib/services/profile-service";

/**
 * GET /api/profiles/[profileId]/avatar
 * Get current avatar URL for a profile
 */
export const GET = withAuth(async (user, _request, params) => {
  try {
    const result = await profileService.getAvatar(params!.profileId, user.id);
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/profiles/[profileId]/avatar
 * Delete avatar for a profile (sets avatar_url to null and deletes storage file)
 */
export const DELETE = withAuth(async (user, _request, params) => {
  try {
    await profileService.deleteAvatar(params!.profileId, user.id);
    return successResponse({ message: "Avatar deleted successfully" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}
