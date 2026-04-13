import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { pinItemSchema } from "@/lib/validations/post";
import * as boardService from "@/lib/services/board-service";

/**
 * POST /api/communities/[communityId]/board/pin
 * Pin an item (offering or post) to the top of the board.
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    const data = await parseJsonBody(request, pinItemSchema);
    await boardService.pinItem(params!.communityId, user.id, data);
    return successResponse({ pinned: true }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/communities/[communityId]/board/pin
 * Remove the pinned item from the board.
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await boardService.unpinItem(params!.communityId, user.id);
    return successResponse({ unpinned: true });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}
