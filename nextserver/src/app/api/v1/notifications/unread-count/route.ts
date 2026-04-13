import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { prisma } from "@/lib/prisma";
import type { NotificationUnreadCountResponse } from "@/types/notification";

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the authenticated user
 */
export const GET = withAuth(async (user) => {
  try {
    const count = await prisma.notifications.count({
      where: { profile_id: user.id, is_read: false },
    });

    return successResponse({
      unread_count: count,
    });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
