import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { signImageUploadSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/profiles/{profileId}/avatar/sign
 *
 * Returns a presigned PUT URL for uploading a new avatar to R2.
 * Users may only sign uploads for their own profile.
 */
export const POST = withAuth<{ profileId: string }>(async (user, request: NextRequest, params) => {
  try {
    if (user.id !== params!.profileId) {
      return ApiErrors.forbidden("You can only upload avatars to your own profile");
    }
    const input = await parseJsonBody(request, signImageUploadSchema);
    const presigned = await storageService.signAvatarUpload(params!.profileId, {
      filename: input.filename,
      contentType: input.content_type,
    });
    return successResponse(presigned);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
