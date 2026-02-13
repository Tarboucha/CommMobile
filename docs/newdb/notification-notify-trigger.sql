-- ==========================================
-- NOTIFICATIONS: pg_notify trigger on notifications
-- Fires on every INSERT into notifications table.
-- Sends a JSON payload to the 'notification_created' channel,
-- picked up by PgNotifyManager → notification-listener.
-- ==========================================

CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_badge_count INT;
BEGIN
  -- Count unread notifications for this user
  SELECT COUNT(*) INTO v_badge_count
  FROM notifications
  WHERE profile_id = NEW.profile_id AND is_read = FALSE;

  PERFORM pg_notify('notification_created', json_build_object(
    'notification_id', NEW.id,
    'profile_id', NEW.profile_id,
    'notification_type', NEW.notification_type,
    'title', NEW.title,
    'body', NEW.body,
    'data_json', NEW.data_json,
    'related_booking_id', NEW.related_booking_id,
    'related_offering_id', NEW.related_offering_id,
    'related_community_id', NEW.related_community_id,
    'badge_count', v_badge_count,
    'created_at', NEW.created_at
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_new_notification();
