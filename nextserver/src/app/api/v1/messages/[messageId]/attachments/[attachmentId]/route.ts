import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertMessageSender } from "@/lib/guards/assert-message-sender";
import * as storageService from "@/lib/services/storage-service";

/**
 * DELETE /api/v1/messages/{messageId}/attachments/{attachmentId}
 * Remove an attachment from a message. Only the message sender can.
 */
export const DELETE = withAuth<{ messageId: string; attachmentId: string }>(
  async (user, _request: NextRequest, params) => {
    try {
      await assertMessageSender(params!.messageId, user.id);
      await storageService.deleteMessageAttachment(params!.attachmentId);
      return successResponse({ message: "Attachment removed" });
    } catch (err) {
      return handleServiceError(err);
    }
  }
);

export async function GET() { return handleUnsupportedMethod(["DELETE"]); }
export async function POST() { return handleUnsupportedMethod(["DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["DELETE"]); }
