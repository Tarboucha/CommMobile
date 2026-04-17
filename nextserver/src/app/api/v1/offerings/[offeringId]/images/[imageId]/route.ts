import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertOfferingOwner } from "@/lib/guards/assert-offering-owner";
import * as storageService from "@/lib/services/storage-service";

/**
 * DELETE /api/v1/offerings/{offeringId}/images/{imageId}
 * Remove an image from an offering (DB row + R2 object).
 */
export const DELETE = withAuth<{ offeringId: string; imageId: string }>(
  async (user, _request: NextRequest, params) => {
    try {
      const offering = await assertOfferingOwner(params!.offeringId, user.id);
      const result = await storageService.deleteOfferingImage(
        { id: offering.id, provider_id: offering.provider_id },
        params!.imageId
      );
      return successResponse(result);
    } catch (err) {
      return handleServiceError(err);
    }
  }
);

export async function GET() { return handleUnsupportedMethod(["DELETE"]); }
export async function POST() { return handleUnsupportedMethod(["DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["DELETE"]); }
