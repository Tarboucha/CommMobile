-- =============================================================================
-- Auth schema — run once after PostgreSQL container is created
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Users (email + bcrypt password — profile data stays in public.profiles)
CREATE TABLE IF NOT EXISTS auth.users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,          -- bcrypt, portable from Supabase
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- Refresh tokens (rotating — one active token per session, many sessions allowed)
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,   -- random 64-byte hex string
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,            -- NULL = active
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON auth.refresh_tokens(token)
  WHERE revoked_at IS NULL;

-- Email verification tokens
CREATE TABLE IF NOT EXISTS auth.email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS auth.password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION auth.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_updated_at ON auth.users;
CREATE TRIGGER trg_auth_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.set_updated_at();
