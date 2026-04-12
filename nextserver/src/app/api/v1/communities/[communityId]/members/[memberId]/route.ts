import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { updateMemberSchema } from "@/lib/validations/community";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as communityService from "@/lib/services/community-service";

/**
 * PATCH /api/communities/[communityId]/members/[memberId]
 * Update member role/permissions/status — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, updateMemberSchema);
    const updated = await communityService.updateMember(
      params!.communityId,
      params!.memberId,
      user.id,
      input
    );
    return successResponse({ member: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/communities/[communityId]/members/[memberId]
 * Remove a member — admin/owner only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await communityService.removeMember(
      params!.communityId,
      params!.memberId,
      user.id
    );
    return successResponse({ message: "Member removed" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function POST() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
