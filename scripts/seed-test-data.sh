#!/usr/bin/env bash
# =============================================================================
# Seed test data for e2e tests. Works against a fresh empty DB.
# Expects the full stack to be running (auth-service + postgres).
#
# Usage: ./scripts/seed-test-data.sh
# =============================================================================
set -euo pipefail

AUTH_URL="${AUTH_SERVICE_URL:-http://localhost:3004}"
DB_CONTAINER="${DB_CONTAINER:-kodo-postgres}"
DB_USER="${DB_USER:-kodo}"
DB_NAME="${DB_NAME:-kodo}"

echo "→ Seeding test data..."

# ── 1. Register test users via auth-service ─────────────────
for EMAIL in test2@kodo.com test3@kodo.com; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"test123\"}")
  if [ "$STATUS" = "201" ]; then
    echo "  ✓ registered $EMAIL"
  elif [ "$STATUS" = "409" ]; then
    echo "  ✓ $EMAIL already exists"
  else
    echo "  ✗ failed to register $EMAIL (HTTP $STATUS)"
    exit 1
  fi
done

# ── 2. Verify email flags (skip email verification for tests) ─
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q <<'SQL'
UPDATE auth.users SET email_verified = true
WHERE email IN ('test2@kodo.com', 'test3@kodo.com') AND email_verified = false;
SQL
echo "  ✓ email_verified set to true"

# ── 3. Create test community + memberships ──────────────────
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q <<'SQL'
DO $$
DECLARE
  v_provider_id UUID;
  v_customer_id UUID;
  v_community_id UUID;
BEGIN
  SELECT id INTO v_provider_id FROM profiles WHERE email = 'test3@kodo.com';
  SELECT id INTO v_customer_id FROM profiles WHERE email = 'test2@kodo.com';

  IF v_provider_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Test profiles not found — did auth/register fail?';
  END IF;

  -- Create community if not exists
  SELECT id INTO v_community_id FROM communities
  WHERE community_name = 'Test Community' AND created_by_profile_id = v_provider_id;

  IF v_community_id IS NULL THEN
    INSERT INTO communities (created_by_profile_id, community_name, access_type)
    VALUES (v_provider_id, 'Test Community', 'invite_only')
    RETURNING id INTO v_community_id;
  END IF;

  -- Add provider as owner (can post offerings)
  INSERT INTO community_members (community_id, profile_id, member_role, membership_status, join_method, can_post_offerings, can_invite_members)
  VALUES (v_community_id, v_provider_id, 'owner', 'active', 'direct', true, true)
  ON CONFLICT DO NOTHING;

  -- Add customer as member
  INSERT INTO community_members (community_id, profile_id, member_role, membership_status, join_method, can_post_offerings, can_invite_members)
  VALUES (v_community_id, v_customer_id, 'member', 'active', 'direct', false, false)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'community=% provider=% customer=%', v_community_id, v_provider_id, v_customer_id;
END $$;
SQL
echo "  ✓ community + memberships created"

echo "→ Seed complete"
