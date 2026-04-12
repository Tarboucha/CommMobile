import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { updateOfferingSchema } from "@/lib/validations/offering";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as offeringService from "@/lib/services/offering-service";

export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  try {
    const offering = await offeringService.getOfferingDetail(params!.offeringId);
    return successResponse({ offering });
  } catch (err) {
    return handleServiceError(err);
  }
});

export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, updateOfferingSchema);
    const offering = await offeringService.updateOffering(params!.offeringId, user.id, input);
    return successResponse({ offering });
  } catch (err) {
    return handleServiceError(err);
  }
});

export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await offeringService.softDeleteOffering(params!.offeringId, user.id);
    return successResponse({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
