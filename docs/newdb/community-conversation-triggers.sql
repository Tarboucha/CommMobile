-- ==========================================
-- COMMUNITY CONVERSATION AUTO-MANAGEMENT
-- Triggers that keep conversations and
-- conversation_participants in sync with
-- communities and community_members.
-- ==========================================

BEGIN;

-- 1. When a community is created, auto-create its conversation
--    and add the creator as the first participant.
CREATE OR REPLACE FUNCTION create_community_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  INSERT INTO conversations (conversation_type, community_id, created_by_profile_id)
  VALUES ('community', NEW.id, NEW.created_by_profile_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES (v_conversation_id, NEW.created_by_profile_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_conversation_on_community_insert
  AFTER INSERT ON communities
  FOR EACH ROW EXECUTE FUNCTION create_community_conversation();

-- 2. When a community member becomes active, add them as a
--    conversation participant. Handles both direct inserts
--    with status='active' and updates from 'pending' to 'active'.
CREATE OR REPLACE FUNCTION sync_member_to_conversation_participant()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Only act when membership_status becomes 'active'
  IF NEW.membership_status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Skip if this was already active (no change)
  IF TG_OP = 'UPDATE' AND OLD.membership_status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE community_id = NEW.community_id
    AND conversation_type = 'community'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, profile_id)
    VALUES (v_conversation_id, NEW.profile_id)
    ON CONFLICT (conversation_id, profile_id) DO UPDATE
      SET left_at = NULL, removed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_member_to_conversation_on_join
  AFTER INSERT OR UPDATE ON community_members
  FOR EACH ROW EXECUTE FUNCTION sync_member_to_conversation_participant();

-- 3. When a member leaves or is removed, mark them as
--    left/removed in conversation_participants.
CREATE OR REPLACE FUNCTION remove_member_from_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Only act when status changes away from 'active'
  IF NEW.membership_status = 'active' THEN
    RETURN NEW;
  END IF;
  IF OLD.membership_status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE community_id = NEW.community_id
    AND conversation_type = 'community'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    IF NEW.membership_status = 'left' THEN
      UPDATE conversation_participants
      SET left_at = NOW()
      WHERE conversation_id = v_conversation_id
        AND profile_id = NEW.profile_id;
    ELSIF NEW.membership_status = 'removed' THEN
      UPDATE conversation_participants
      SET removed_at = NOW(),
          removed_by_id = NEW.removed_by_profile_id
      WHERE conversation_id = v_conversation_id
        AND profile_id = NEW.profile_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER remove_member_from_conversation_on_leave
  AFTER UPDATE ON community_members
  FOR EACH ROW EXECUTE FUNCTION remove_member_from_conversation();

-- 4. Backfill: create conversations for existing communities
--    that don't have one yet, and add their active members.
DO $$
DECLARE
  r RECORD;
  v_conversation_id UUID;
BEGIN
  FOR r IN
    SELECT c.id AS community_id, c.created_by_profile_id
    FROM communities c
    WHERE c.is_active = TRUE
      AND c.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM conversations conv
        WHERE conv.community_id = c.id
          AND conv.conversation_type = 'community'
      )
  LOOP
    INSERT INTO conversations (conversation_type, community_id, created_by_profile_id)
    VALUES ('community', r.community_id, r.created_by_profile_id)
    RETURNING id INTO v_conversation_id;

    INSERT INTO conversation_participants (conversation_id, profile_id)
    SELECT v_conversation_id, cm.profile_id
    FROM community_members cm
    WHERE cm.community_id = r.community_id
      AND cm.membership_status = 'active';
  END LOOP;
END;
$$;

COMMIT;
