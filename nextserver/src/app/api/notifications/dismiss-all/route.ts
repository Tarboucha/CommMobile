import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/notifications/dismiss-all
 * Mark all unread notifications as read for the authenticated user
 */
export const PATCH = withAuth(async (user) => {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to mark all notifications as read:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "All notifications marked as read" });
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
