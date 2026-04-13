import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { baseProfileSchema } from "@/lib/validations/profile";
import * as profileService from "@/lib/services/profile-service";

/**
 * GET /api/profiles/[profileId]
 * Get a specific profile by ID
 * Users can only access their own profile
 */
export const GET = withAuth(async (user, _request, params) => {
  try {
    const profile = await profileService.getProfile(params!.profileId, user.id);
    return successResponse({ profile });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * PATCH /api/profiles/[profileId]
 * Update a specific profile by ID
 * Users can only update their own profile
 * Editable fields: first_name, last_name, display_name, bio, phone, preferred_language
 */
export const PATCH = withAuth(async (user, request, params) => {
  try {
    const rawData = await parseJsonBody(request, baseProfileSchema.partial());
    const profile = await profileService.updateProfile(params!.profileId, user.id, rawData);
    return successResponse({ profile });
  } catch (err) {
    return handleServiceError(err);
  }
});

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}
