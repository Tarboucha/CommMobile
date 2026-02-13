import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { notificationFilterSchema } from "@/lib/validations/notification";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/notifications
 * List notifications for the authenticated user (cursor-based pagination)
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();
  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());

  const validation = notificationFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { is_read, notification_type, limit, after } = validation.data;

  // Build main query
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", user.id);

  if (typeof is_read === "boolean") {
    query = query.eq("is_read", is_read);
  }

  if (notification_type) {
    query = query.eq("notification_type", notification_type);
  }

  query = applyCursorPagination(query, { limit, after });

  // Build unread count query in parallel
  const unreadQuery = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("is_read", false);

  const [{ data: notifications, error }, { count: unreadCount, error: unreadError }] =
    await Promise.all([query, unreadQuery]);

  if (error) {
    console.error("Error fetching notifications:", error);
    return ApiErrors.serverError();
  }

  if (unreadError) {
    console.error("Error fetching unread count:", unreadError);
    return ApiErrors.serverError();
  }

  const paginated = buildPaginatedResponse(notifications || [], limit);

  return successResponse({
    ...paginated,
    unread_count: unreadCount || 0,
  });
});

/**
 * DELETE /api/notifications
 * Delete all notifications for the authenticated user
 */
export const DELETE = withAuth(async (user) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("profile_id", user.id);

  if (error) {
    console.error("Failed to delete all notifications:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "All notifications deleted" });
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}
