import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/notifications/dismiss-all
 * Mark all unread notifications as read for the authenticated user
 */
export const PATCH = withAuth(async (user) => {
  try {
    await prisma.notifications.updateMany({
      where: { profile_id: user.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });

    return successResponse({ message: "All notifications marked as read" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["PATCH"]);
}
