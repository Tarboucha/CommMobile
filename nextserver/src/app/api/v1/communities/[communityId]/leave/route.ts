import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as communityService from "@/lib/services/community-service";

/**
 * POST /api/communities/[communityId]/leave
 * Leave a community — sets membership_status to 'left'
 * Owner cannot leave (must transfer ownership first)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await communityService.leaveCommunity(params!.communityId, user.id);
    return successResponse({ message: "You have left the community" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
