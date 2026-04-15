-- =============================================================================
-- Migrate users from Supabase auth.users → auth.users (our schema)
-- Run AFTER pg_dump restore from Supabase (which includes their auth schema)
-- =============================================================================
--
-- Supabase auth.users columns we use:
--   id                  — Supabase auth user UUID (NOT what we want as the new ID)
--   email               — user email
--   encrypted_password  — bcrypt hash (portable!)
--   email_confirmed_at  — non-NULL = verified
--   created_at
--
-- Our auth.users.id = public.profiles.id (profile ID becomes the auth identity)
-- This is the key change: sub in JWT is now profile_id directly.
-- =============================================================================

-- Temporarily rename the Supabase auth.users so we can distinguish them
-- (Only needed if migrating into the same postgres cluster as the pg_dump)

INSERT INTO auth.users (id, email, password_hash, email_verified, created_at)
SELECT
  p.id,                                      -- profile ID becomes auth user ID
  au.email,
  au.encrypted_password,                     -- bcrypt hash works directly
  (au.email_confirmed_at IS NOT NULL),
  au.created_at
FROM auth.users au
JOIN public.profiles p ON p.auth_user_id = au.id
ON CONFLICT (id) DO NOTHING;

-- Verify: row counts should match
-- SELECT COUNT(*) FROM auth.users;   -- should equal public.profiles count
