/**
 * Notification trigger payload from PostgreSQL pg_notify.
 * Matches the json_build_object in notify_new_notification() trigger.
 */
export interface NotificationTriggerPayload {
  [key: string]: unknown
  notification_id: string
  profile_id: string
  notification_type: string
  title: string
  body: string | null
  data_json: Record<string, unknown> | null
  related_booking_id: string | null
  related_offering_id: string | null
  related_community_id: string | null
  badge_count: number
  created_at: string
}
