import { Database } from "@/types/supabase";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
export type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

// notification_type is a plain string in the DB, these are the expected values
export const NotificationTypeValues = [
  // Booking notifications
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

export interface NotificationQueryParams {
  limit?: number;
  after?: string;
  is_read?: boolean;
  notification_type?: NotificationType;
}

// ============================================================================
// UI Configuration
// ============================================================================

export interface NotificationTypeConfig {
  color: string;
  backgroundColor: string;
  badgeText: string;
  label: string;
}

// ============================================================================
// Push Notification
// ============================================================================

export interface PushNotificationData {
  type?: string;
  notification_id?: string;
  [key: string]: string | undefined;
}
