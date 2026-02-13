-- ==========================================
-- CHAT: pg_notify trigger on messages
-- Fires on every INSERT into messages table.
-- Sends a JSON payload to the 'message_created' channel,
-- picked up by PgNotifyManager → chat-listener.
-- ==========================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_type TEXT;
  v_community_id UUID;
  v_booking_id UUID;
BEGIN
  SELECT conversation_type, community_id, booking_id
  INTO v_conversation_type, v_community_id, v_booking_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  PERFORM pg_notify('message_created', json_build_object(
    'message_id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'conversation_type', v_conversation_type,
    'community_id', v_community_id,
    'booking_id', v_booking_id,
    'sender_id', NEW.sender_id,
    'content', LEFT(NEW.content, 7000),
    'created_at', NEW.created_at
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
