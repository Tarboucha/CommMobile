import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as notificationService from "@/lib/services/notification-service";

/**
 * PATCH /api/notifications/[notificationId]
 * Mark a notification as read
 */
export const PATCH = withAuth(async (user, _request: NextRequest, params) => {
  try {
    const updated = await notificationService.markAsRead(
      params!.notificationId,
      user.id
    );
    return successResponse({ notification: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/notifications/[notificationId]
 * Delete a single notification
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await notificationService.deleteNotification(
      params!.notificationId,
      user.id
    );
    return successResponse({ message: "Notification deleted" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function POST() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
