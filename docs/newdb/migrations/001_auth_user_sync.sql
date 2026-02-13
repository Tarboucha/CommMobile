-- ==========================================
-- Migration: Improved Auth User Sync
-- Adds missing columns and improved trigger functions
-- ==========================================

-- ==========================================
-- 1. ADD MISSING COLUMNS TO PROFILES
-- ==========================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for last login (useful for activity queries)
CREATE INDEX IF NOT EXISTS idx_profiles_last_login
  ON profiles(last_login_at DESC)
  WHERE last_login_at IS NOT NULL;

-- ==========================================
-- 2. DROP EXISTING TRIGGER AND FUNCTION
-- ==========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ==========================================
-- 3. IMPROVED HANDLE_NEW_USER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if no email (shouldn't happen but safety check)
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    auth_user_id,
    email,
    first_name,
    last_name,
    display_name,
    avatar_url,
    is_email_verified,
    last_login_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Extract first_name from metadata with fallbacks
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), ''),
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'name', ' ', 1), '')
    ),
    -- Extract last_name from metadata with fallbacks
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'full_name', '')) + 1), ''),
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'name' FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'name', '')) + 1), '')
    ),
    -- Display name from metadata
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Avatar URL from OAuth providers
    NEW.raw_user_meta_data->>'avatar_url',
    -- Email verified status
    (NEW.confirmed_at IS NOT NULL),
    -- Last login
    NEW.last_sign_in_at
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==========================================
-- 4. HANDLE AUTH USER UPDATE FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION handle_auth_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    -- Update email if changed
    email = COALESCE(NEW.email, email),

    -- Update verification status
    is_email_verified = (NEW.confirmed_at IS NOT NULL),

    -- Update last login time
    last_login_at = COALESCE(NEW.last_sign_in_at, last_login_at),

    -- Update avatar if provided by OAuth and we don't have one
    avatar_url = COALESCE(
      avatar_url,
      NEW.raw_user_meta_data->>'avatar_url'
    ),

    -- Update names if provided and currently empty
    first_name = COALESCE(
      NULLIF(first_name, ''),
      NEW.raw_user_meta_data->>'first_name',
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), ''),
      first_name
    ),
    last_name = COALESCE(
      NULLIF(last_name, ''),
      NEW.raw_user_meta_data->>'last_name',
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'full_name', '')) + 1), ''),
      last_name
    ),

    -- updated_at is handled by trigger
    updated_at = NOW()
  WHERE auth_user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the update trigger
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.confirmed_at IS DISTINCT FROM NEW.confirmed_at OR
    OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at OR
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
  )
  EXECUTE FUNCTION handle_auth_user_update();

-- ==========================================
-- 5. COMMENTS
-- ==========================================

COMMENT ON FUNCTION handle_new_user IS 'Creates a profile when a new auth user signs up. Extracts name/avatar from OAuth metadata.';
COMMENT ON FUNCTION handle_auth_user_update IS 'Syncs profile when auth user is updated (email verification, login, metadata changes).';
COMMENT ON COLUMN profiles.is_email_verified IS 'Synced from auth.users.confirmed_at';
COMMENT ON COLUMN profiles.last_login_at IS 'Synced from auth.users.last_sign_in_at';
