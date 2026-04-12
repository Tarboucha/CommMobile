import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import type { NotificationResponse } from "@/types/notification";

/**
 * PATCH /api/notifications/[notificationId]
 * Mark a notification as read
 */
export const PATCH = withAuth(async (user, _request: NextRequest, params) => {
  const notificationId = params?.notificationId;
  if (!notificationId) {
    return ApiErrors.badRequest("Notification ID is required");
  }

  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, profile_id: user.id },
  });

  if (!notification) {
    return ApiErrors.notFound("Notification not found");
  }

  try {
    const updated = await prisma.notifications.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });

    return successResponse<NotificationResponse>({ notification: updated as any });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/notifications/[notificationId]
 * Delete a single notification
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const notificationId = params?.notificationId;
  if (!notificationId) {
    return ApiErrors.badRequest("Notification ID is required");
  }

  try {
    await prisma.notifications.deleteMany({
      where: { id: notificationId, profile_id: user.id },
    });

    return successResponse({ message: "Notification deleted" });
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return ApiErrors.serverError();
  }
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}
