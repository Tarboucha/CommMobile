-- ==========================================
-- COMPLETE RLS FIX
-- Run this once against your Supabase DB.
--
-- Fixes two categories of problems:
--   1. Recursive policies  (42P17 infinite recursion)
--   2. Trigger functions    (42501 policy violation)
--
-- Rule of thumb:
--   - Any HELPER FUNCTION called from RLS that
--     queries an RLS-protected table → SECURITY DEFINER
--   - Any TRIGGER FUNCTION that writes/reads
--     across RLS-protected tables → SECURITY DEFINER
--   - BEFORE triggers on the SAME table are fine
--     (RLS hasn't been checked yet)
-- ==========================================

BEGIN;

-- ==========================================
-- PART 1: HELPER FUNCTIONS (SECURITY DEFINER)
-- These are called from within RLS policies.
-- They must bypass RLS to avoid recursion.
-- ==========================================

-- Already SECURITY DEFINER, included for completeness
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_community_admin(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
    AND member_role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION shares_community_with_current_user(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.profile_id = p_profile_id
    AND cm2.profile_id = get_current_profile_id()
    AND cm1.membership_status = 'active'
    AND cm2.membership_status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND profile_id = get_current_profile_id()
    AND left_at IS NULL
    AND removed_at IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- PART 2: TRIGGER FUNCTIONS (SECURITY DEFINER)
-- These write/read across RLS-protected tables.
-- Without SECURITY DEFINER they hit policy violations.
-- ==========================================

-- Inserts into community_members when a community is created
CREATE OR REPLACE FUNCTION add_community_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_members (
    community_id,
    profile_id,
    join_method,
    membership_status,
    member_role,
    can_post_offerings,
    can_invite_members,
    membership_approved_at
  ) VALUES (
    NEW.id,
    NEW.created_by_profile_id,
    'direct_invite',
    'active',
    'owner',
    TRUE,
    TRUE,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updates communities.current_members_count from community_members trigger
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = NEW.community_id
      AND membership_status = 'active'
    )
    WHERE id = NEW.community_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = COALESCE(OLD.community_id, NEW.community_id)
      AND membership_status = 'active'
    )
    WHERE id = COALESCE(OLD.community_id, NEW.community_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updates conversations from messages trigger
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reads offerings + bookings from booking_items trigger
CREATE OR REPLACE FUNCTION validate_booking_not_own_offering()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM offerings o
    JOIN bookings b ON b.id = NEW.booking_id
    WHERE o.id = NEW.offering_id
    AND o.provider_id = b.customer_id
  ) THEN
    RAISE EXCEPTION 'Cannot book your own offering';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reads conversations from messages trigger
CREATE OR REPLACE FUNCTION set_message_expiration()
RETURNS TRIGGER AS $$
DECLARE
  conv_type conversation_type;
BEGIN
  SELECT conversation_type INTO conv_type
  FROM conversations WHERE id = NEW.conversation_id;

  NEW.expires_at := CASE conv_type
    WHEN 'direct' THEN NOW() + INTERVAL '90 days'
    WHEN 'community' THEN NOW() + INTERVAL '1 year'
    WHEN 'booking' THEN NOW() + INTERVAL '7 years'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reads bookings from booking_items context (generate_booking_number)
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_number = new_number) INTO exists_already;
    IF NOT exists_already THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 3: FIX RECURSIVE RLS POLICIES
-- Replace self-referencing inline subqueries
-- with SECURITY DEFINER helper function calls.
-- ==========================================

-- community_members: was self-referencing
DROP POLICY IF EXISTS "Members can view other members in their communities" ON community_members;
CREATE POLICY "Members can view other members in their communities"
  ON community_members FOR SELECT
  USING (
    is_community_member(community_id)
    OR profile_id = get_current_profile_id()
  );

-- profiles: was joining community_members x2 inline
DROP POLICY IF EXISTS "Users can view profiles of community members" ON profiles;
CREATE POLICY "Users can view profiles of community members"
  ON profiles FOR SELECT
  USING (shares_community_with_current_user(id));

-- conversation_participants: was self-referencing
DROP POLICY IF EXISTS "Participants can view conversation participants" ON conversation_participants;
CREATE POLICY "Participants can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id));

-- conversations: use helper instead of inline subquery
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (is_conversation_participant(id));

-- messages SELECT: use helper
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id));

-- messages INSERT: use helper
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = get_current_profile_id()
    AND is_conversation_participant(conversation_id)
  );

-- message_attachments SELECT: use helper
DROP POLICY IF EXISTS "Participants can view message attachments" ON message_attachments;
CREATE POLICY "Participants can view message attachments"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND is_conversation_participant(m.conversation_id)
    )
  );

COMMIT;

-- ==========================================
-- VERIFY:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
--   SELECT proname, prosecdef FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--   AND prosecdef = true
--   ORDER BY proname;
-- ==========================================
