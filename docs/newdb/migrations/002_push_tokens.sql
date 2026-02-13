-- ==========================================
-- Migration: Add Push Tokens Table
-- Stores Expo push notification tokens for mobile devices
-- ==========================================

-- ==========================================
-- 1. CREATE PUSH_TOKENS TABLE
-- ==========================================

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Owner
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Token
  token TEXT NOT NULL,

  -- Device info (optional, useful for debugging)
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ==========================================
-- 2. INDEXES
-- ==========================================

-- Index for looking up tokens by profile (used when sending notifications)
CREATE INDEX idx_push_tokens_profile_id ON push_tokens(profile_id);

-- Unique constraint on token (each token can only belong to one profile)
CREATE UNIQUE INDEX idx_push_tokens_token ON push_tokens(token);

-- Index for active tokens only
CREATE INDEX idx_push_tokens_active ON push_tokens(profile_id)
  WHERE is_active = TRUE;

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own push tokens
CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  USING (profile_id = get_current_profile_id());

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (profile_id = get_current_profile_id());

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  USING (profile_id = get_current_profile_id());

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  USING (profile_id = get_current_profile_id());

-- ==========================================
-- 4. COMMENTS
-- ==========================================

COMMENT ON TABLE push_tokens IS 'Expo push notification tokens for mobile devices';
COMMENT ON COLUMN push_tokens.token IS 'Expo push token (ExponentPushToken[xxx])';
COMMENT ON COLUMN push_tokens.device_type IS 'Platform: ios, android, or web';
COMMENT ON COLUMN push_tokens.last_used_at IS 'Last time a notification was sent to this token';
