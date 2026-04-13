-- ============================================================================
-- Fix RPCs that depend on auth.uid() / get_current_profile_id()
--
-- Problem: After migrating from Supabase client to Prisma $queryRaw,
-- there's no JWT context on the database connection. auth.uid() returns NULL.
--
-- Fix: Add p_profile_id parameter to RPCs that need the caller's identity.
-- The route handler passes user.id (already authenticated by withAuth).
-- ============================================================================


-- ============================================================================
-- join_community_via_invite_link: add p_profile_id parameter
-- ============================================================================

-- Drop the old single-parameter version
DROP FUNCTION IF EXISTS public.join_community_via_invite_link(TEXT);

CREATE OR REPLACE FUNCTION public.join_community_via_invite_link(
  p_token TEXT,
  p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_is_active BOOLEAN;
  v_current_count INT;
  v_max_members INT;
  v_member_id UUID;
  v_existing_status TEXT;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN json_build_object('error', 'Profile ID is required');
  END IF;

  SELECT id, invite_link_expires_at, is_active, current_members_count, max_members
  INTO v_community_id, v_expires_at, v_is_active, v_current_count, v_max_members
  FROM communities
  WHERE invite_link_token = p_token
    AND deleted_at IS NULL;

  IF v_community_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid invite link');
  END IF;

  IF NOT v_is_active THEN
    RETURN json_build_object('error', 'Community is not active');
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN json_build_object('error', 'Invite link has expired');
  END IF;

  IF v_current_count >= COALESCE(v_max_members, 100) THEN
    RETURN json_build_object('error', 'Community is full');
  END IF;

  SELECT id, membership_status INTO v_member_id, v_existing_status
  FROM community_members
  WHERE community_id = v_community_id AND profile_id = p_profile_id;

  IF v_existing_status = 'active' THEN
    RETURN json_build_object('success', true, 'already_member', true, 'member_id', v_member_id);
  END IF;

  IF v_member_id IS NOT NULL AND v_existing_status IN ('left', 'removed') THEN
    UPDATE community_members SET
      membership_status = 'active',
      join_method = 'invite_link',
      membership_approved_at = NOW(),
      membership_removed_at = NULL,
      removed_by_profile_id = NULL,
      removal_reason = NULL
    WHERE id = v_member_id;
    RETURN json_build_object('success', true, 'already_member', false, 'member_id', v_member_id);
  END IF;

  INSERT INTO community_members (
    community_id, profile_id, join_method, membership_status, membership_approved_at
  ) VALUES (
    v_community_id, p_profile_id, 'invite_link', 'active', NOW()
  )
  RETURNING id INTO v_member_id;

  RETURN json_build_object('success', true, 'already_member', false, 'member_id', v_member_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_community_via_invite_link(TEXT, UUID) TO authenticated, service_role;


-- ============================================================================
-- create_direct_conversation: add p_profile_id parameter
-- ============================================================================

-- Drop the old single-parameter version
DROP FUNCTION IF EXISTS public.create_direct_conversation(UUID);

CREATE OR REPLACE FUNCTION public.create_direct_conversation(
  p_other_profile_id UUID,
  p_profile_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_share_community BOOLEAN;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify both users share at least one active community
  SELECT EXISTS (
    SELECT 1
    FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.profile_id = p_profile_id
      AND cm2.profile_id = p_other_profile_id
      AND cm1.membership_status = 'active'
      AND cm2.membership_status = 'active'
  ) INTO v_share_community;

  IF NOT v_share_community THEN
    RAISE EXCEPTION 'Users must share a common community to message each other';
  END IF;

  -- Check for existing direct conversation
  SELECT c.id INTO v_conversation_id
  FROM conversations c
  JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
  JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
  WHERE c.conversation_type = 'direct'
    AND cp1.profile_id = p_profile_id
    AND cp2.profile_id = p_other_profile_id
    AND cp1.left_at IS NULL AND cp1.removed_at IS NULL
    AND cp2.left_at IS NULL AND cp2.removed_at IS NULL
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create the conversation
  INSERT INTO conversations (conversation_type, created_by_profile_id)
  VALUES ('direct', p_profile_id)
  RETURNING id INTO v_conversation_id;

  -- Add both users as participants
  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES
    (v_conversation_id, p_profile_id),
    (v_conversation_id, p_other_profile_id);

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_direct_conversation(UUID, UUID) TO authenticated, service_role;
