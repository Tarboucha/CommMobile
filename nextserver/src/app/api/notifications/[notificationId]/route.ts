import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const { data: notification, error: fetchError } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("profile_id", user.id)
    .single();

  if (fetchError || !notification) {
    return ApiErrors.notFound("Notification not found");
  }

  const { data: updated, error: updateError } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("Failed to mark notification as read:", updateError);
    return ApiErrors.serverError();
  }

  return successResponse<NotificationResponse>({ notification: updated });
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

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("profile_id", user.id);

  if (deleteError) {
    console.error("Failed to delete notification:", deleteError);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "Notification deleted" });
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
