import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertOfferingOwner } from "@/lib/guards/assert-offering-owner";
import { signImageUploadSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/offerings/{offeringId}/images/sign
 *
 * Body: { filename, content_type }
 * Returns: { upload_url, key, expires_in, max_bytes, content_type }
 *
 * Client then PUTs the bytes to upload_url, and finally POSTs to
 * /api/v1/offerings/{offeringId}/images with the returned key.
 */
export const POST = withAuth<{ offeringId: string }>(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, signImageUploadSchema);
    const offering = await assertOfferingOwner(params!.offeringId, user.id);
    const presigned = await storageService.signOfferingImageUpload(
      { id: offering.id, provider_id: offering.provider_id },
      { filename: input.filename, contentType: input.content_type }
    );
    return successResponse(presigned);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
