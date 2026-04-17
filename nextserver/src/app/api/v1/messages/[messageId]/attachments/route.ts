import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertMessageSender } from "@/lib/guards/assert-message-sender";
import { createMessageAttachmentSchema } from "@/lib/validations/storage";
import * as storageService from "@/lib/services/storage-service";

/**
 * GET /api/v1/messages/{messageId}/attachments
 * List attachments for a message. Any participant can read.
 * (For simplicity we only gate write access here; reads rely on conversation-level auth.)
 */
export const GET = withAuth<{ messageId: string }>(async (_user, _request, params) => {
  try {
    const attachments = await storageService.listMessageAttachments(params!.messageId);
    return successResponse({ attachments });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/v1/messages/{messageId}/attachments
 * Persist a newly-uploaded attachment.
 * Body: { key, file_name?, mime_type?, file_size_bytes?, width?, height? }
 */
export const POST = withAuth<{ messageId: string }>(async (user, request: NextRequest, params) => {
  try {
    const message = await assertMessageSender(params!.messageId, user.id);
    const input = await parseJsonBody(request, createMessageAttachmentSchema);
    const attachment = await storageService.persistMessageAttachment(
      { id: message.id, conversation_id: message.conversation_id },
      input
    );
    return successResponse({ attachment }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
