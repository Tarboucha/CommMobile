import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { respondInvitationSchema } from "@/lib/validations/community";
import * as communityService from "@/lib/services/community-service";

/**
 * PATCH /api/communities/[communityId]/invitations/[invitationId]
 * Accept or decline an invitation — invitee only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const { action } = await parseJsonBody(request, respondInvitationSchema);
    const invitation = await communityService.respondToInvitation(
      params!.communityId,
      params!.invitationId,
      user,
      action
    );
    return successResponse({ invitation });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["PATCH"]);
}
