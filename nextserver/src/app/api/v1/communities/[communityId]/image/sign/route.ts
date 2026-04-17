import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { signImageUploadSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/communities/{communityId}/image/sign
 * Returns a presigned URL for uploading a community image (logo/banner).
 * Only owners and admins can change the community image.
 */
export const POST = withAuth<{ communityId: string }>(async (user, request: NextRequest, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id, {
      requiredRoles: ["owner", "admin"],
    });
    const input = await parseJsonBody(request, signImageUploadSchema);
    const presigned = await storageService.signCommunityImageUpload(params!.communityId, {
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
