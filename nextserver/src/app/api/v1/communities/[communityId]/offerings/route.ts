import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors, parseZodError } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { createOfferingSchema, offeringFilterSchema } from "@/lib/validations/offering";
import * as offeringService from "@/lib/services/offering-service";

/**
 * GET /api/communities/[communityId]/offerings
 * List community offerings
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  try {
    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = offeringFilterSchema.safeParse(searchParams);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    const result = await offeringService.listCommunityOfferings(
      params!.communityId,
      validation.data
    );
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/communities/[communityId]/offerings
 * Create a new offering — requires can_post_offerings permission
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    const data = await parseJsonBody(request, createOfferingSchema);
    const offering = await offeringService.createCommunityOffering(
      params!.communityId,
      user.id,
      data
    );
    return successResponse({ offering }, undefined, 201);
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
