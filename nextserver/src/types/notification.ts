import type { notifications, Prisma } from "@/generated/prisma/client";

/**
 * Notification types extracted from the Prisma schema.
 */

// ============================================================================
// Database Types
// ============================================================================

export type Notification = notifications;
export type NotificationInsert = Prisma.notificationsCreateInput;
export type NotificationUpdate = Prisma.notificationsUpdateInput;

// ============================================================================
// Notification Type Values (for reference)
// notification_type is a string field, these are the expected values
// ============================================================================

export const NotificationTypeValues = [
  // Booking notifications
  "booking_new",
  "booking_confirmed",
  "booking_status_update",
  "booking_completed",
  "booking_cancelled",
  // Payment notifications
  "payment_received",
  "payment_refunded",
  // Community notifications
  "community_invite",
  "community_join_request",
  "community_member_approved",
  // Offering notifications
  "new_offering",
  "offering_update",
  // Review notifications
  "new_review",
  // Message notifications
  "new_message",
  // System
  "system",
] as const;

export type NotificationType = (typeof NotificationTypeValues)[number];

// ============================================================================
// API Response Types
// ============================================================================

export interface NotificationResponse {
  notification: Notification;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}

// ============================================================================
// Trigger Payload (from PostgreSQL pg_notify)
// ============================================================================

/**
 * Notification payload from PostgreSQL trigger (pg_notify)
 * Matches the json_build_object in notify_new_notification()
 */
export interface NotificationTriggerPayload {
  [key: string]: unknown;
  notification_id: string;
  profile_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  data_json: Record<string, unknown> | null;
  related_booking_id: string | null;
  related_offering_id: string | null;
  related_community_id: string | null;
  badge_count: number;
  created_at: string;
}
