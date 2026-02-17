-- ============================================================================
-- Migration 006: create_booking_conversation RPC
--
-- Problem: Creating a booking conversation via INSERT + RETURNING fails because:
--   1. INSERT policy only allows conversation_type = 'direct'
--   2. SELECT policy checks is_conversation_participant(), but participants
--      aren't added yet when RETURNING runs
--
-- Solution: SECURITY DEFINER function that atomically creates conversation +
--           participants, same pattern as create_direct_conversation.
-- ============================================================================

-- Also update INSERT policy to allow 'booking' type conversations
DROP POLICY IF EXISTS "Users can create direct conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    conversation_type IN ('direct', 'booking') AND
    created_by_profile_id = get_current_profile_id()
  );

-- SECURITY DEFINER function: create booking conversation atomically
CREATE OR REPLACE FUNCTION create_booking_conversation(
  p_booking_id UUID,
  p_creator_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_customer_id UUID;
  v_provider_id UUID;
  v_existing_id UUID;
BEGIN
  -- 1. Verify booking exists and get participants
  SELECT customer_id, provider_id
  INTO v_customer_id, v_provider_id
  FROM bookings
  WHERE id = p_booking_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. Verify creator is a party to the booking
  IF p_creator_profile_id != v_customer_id AND p_creator_profile_id != v_provider_id THEN
    RAISE EXCEPTION 'Not a party to this booking';
  END IF;

  -- 3. Check for existing booking conversation (idempotent)
  SELECT id INTO v_existing_id
  FROM conversations
  WHERE booking_id = p_booking_id
    AND conversation_type = 'booking'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 4. Create conversation
  INSERT INTO conversations (conversation_type, booking_id, created_by_profile_id)
  VALUES ('booking', p_booking_id, p_creator_profile_id)
  RETURNING id INTO v_conversation_id;

  -- 5. Add both parties as participants
  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES
    (v_conversation_id, v_customer_id),
    (v_conversation_id, v_provider_id)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation_id;
END;
$$;
