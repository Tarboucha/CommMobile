import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, parseZodError } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { notificationFilterSchema } from "@/lib/validations/notification";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as notificationService from "@/lib/services/notification-service";

/**
 * GET /api/notifications
 * List notifications for the authenticated user (cursor-based pagination)
 * Simple paginated read — Prisma called directly (no service needed)
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  try {
    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = notificationFilterSchema.safeParse(searchParams);
    if (!validation.success) {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      throw new ValidationError(parseZodError(validation.error));
    }

    const { is_read, notification_type, limit, after } = validation.data;

    // Build where clause
    const where: any = { profile_id: user.id };
    if (typeof is_read === "boolean") where.is_read = is_read;
    if (notification_type) where.notification_type = notification_type;

    // Cursor filter
    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          {
            created_at: { equals: new Date(cursor.created_at) },
            id: { lt: cursor.id },
          },
        ];
      }
    }

    // Fetch notifications + unread count in parallel
    const [notifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      prisma.notifications.count({
        where: { profile_id: user.id, is_read: false },
      }),
    ]);

    const paginated = buildPaginatedResponse(
      notifications.map((n) => ({
        ...n,
        created_at: n.created_at?.toISOString() ?? null,
      })),
      limit
    );

    return successResponse({
      ...paginated,
      unread_count: unreadCount,
    });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/notifications
 * Delete all notifications for the authenticated user
 */
export const DELETE = withAuth(async (user) => {
  try {
    await notificationService.deleteAllNotifications(user.id);
    return successResponse({ message: "All notifications deleted" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET", "DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["GET", "DELETE"]); }
