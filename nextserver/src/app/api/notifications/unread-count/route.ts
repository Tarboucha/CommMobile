import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import type { NotificationUnreadCountResponse } from "@/types/notification";

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the authenticated user
 */
export const GET = withAuth(async (user) => {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error fetching unread notifications count:", error);
    return ApiErrors.serverError();
  }

  return successResponse<NotificationUnreadCountResponse>({
    unread_count: count || 0,
  });
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
