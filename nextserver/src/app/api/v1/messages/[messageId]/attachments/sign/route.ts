import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertMessageSender } from "@/lib/guards/assert-message-sender";
import { signImageUploadSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * POST /api/v1/messages/{messageId}/attachments/sign
 * Returns a presigned URL for uploading an attachment to a message.
 * Only the message sender may attach files.
 */
export const POST = withAuth<{ messageId: string }>(async (user, request: NextRequest, params) => {
  try {
    const message = await assertMessageSender(params!.messageId, user.id);
    const input = await parseJsonBody(request, signImageUploadSchema);
    const presigned = await storageService.signMessageAttachmentUpload(
      { id: message.id, conversation_id: message.conversation_id },
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
