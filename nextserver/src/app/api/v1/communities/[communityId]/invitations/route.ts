import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors, parseZodError } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { createInvitationSchema } from "@/lib/validations/community";
import { paginationSchema } from "@/lib/validations/pagination";
import * as communityService from "@/lib/services/community-service";

/**
 * GET /api/communities/[communityId]/invitations
 * List invitations
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

    const result = await communityService.listInvitations(
      params!.communityId,
      validation.data
    );
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/communities/[communityId]/invitations
 * Create an invitation — requires invite permission
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, createInvitationSchema);
    const invitation = await communityService.createInvitation(
      params!.communityId,
      user.id,
      input
    );
    return successResponse({ invitation }, undefined, 201);
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
