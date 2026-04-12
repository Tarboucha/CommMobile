import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
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

    return successResponse<NotificationUnreadCountResponse>({
      unread_count: count,
    });
  } catch (error) {
    console.error("Error fetching unread notifications count:", error);
    return ApiErrors.serverError();
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
