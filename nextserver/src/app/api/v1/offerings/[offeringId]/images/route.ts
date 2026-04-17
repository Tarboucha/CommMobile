import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertOfferingOwner } from "@/lib/guards/assert-offering-owner";
import { createImageFromKeySchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * GET /api/v1/offerings/{offeringId}/images
 * List all images attached to an offering.
 */
export const GET = withAuth<{ offeringId: string }>(async (_user, _request: NextRequest, params) => {
  try {
    const images = await storageService.listOfferingImages(params!.offeringId);
    return successResponse({ images });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/v1/offerings/{offeringId}/images
 * Persist an offering image row, given an R2 key from a prior /sign + PUT.
 *
 * Body: { key, make_primary? }
 */
export const POST = withAuth<{ offeringId: string }>(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, createImageFromKeySchema);
    const offering = await assertOfferingOwner(params!.offeringId, user.id);
    const image = await storageService.persistOfferingImage(
      { id: offering.id, provider_id: offering.provider_id },
      { key: input.key, makePrimary: input.make_primary }
    );
    return successResponse({ image }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
