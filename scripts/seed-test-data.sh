#!/usr/bin/env bash
# =============================================================================
# Seed test data for e2e tests. Works against a fresh empty DB.
# Expects the full stack to be running (auth-service + postgres).
# =============================================================================
set -euo pipefail

AUTH_URL="${AUTH_SERVICE_URL:-http://localhost:3004}"
DB_CONTAINER="${DB_CONTAINER:-kodo-postgres}"
DB_USER="${DB_USER:-kodo}"
DB_NAME="${DB_NAME:-kodo}"

psql() {
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 --echo-errors "$@"
}

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

# ── 2. Verify email flags ─────────────────────────────────
psql <<'SQL'
UPDATE auth.users SET email_verified = true
WHERE email IN ('test2@kodo.com', 'test3@kodo.com');
SQL
echo "  ✓ email_verified flags set"

# ── 3. Verify profiles exist (auth-service creates them on register) ──
PROFILE_COUNT=$(psql -tA <<'SQL'
SELECT count(*) FROM profiles WHERE email IN ('test2@kodo.com', 'test3@kodo.com');
SQL
)
if [ "$PROFILE_COUNT" != "2" ]; then
  echo "  ✗ Expected 2 profiles, found $PROFILE_COUNT"
  exit 1
fi
echo "  ✓ 2 profiles exist"

# ── 4. Create community + add customer as member ────────────
# The add_creator_as_owner trigger auto-inserts the provider as owner
# with can_post_offerings=true. We just add the customer.
psql <<'SQL'
DO $$
DECLARE
  v_provider_id UUID;
  v_customer_id UUID;
  v_community_id UUID;
BEGIN
  SELECT id INTO v_provider_id FROM profiles WHERE email = 'test3@kodo.com';
  SELECT id INTO v_customer_id FROM profiles WHERE email = 'test2@kodo.com';

  -- Reuse existing test community or create new
  SELECT id INTO v_community_id FROM communities
  WHERE community_name = 'Test Community' AND created_by_profile_id = v_provider_id;

  IF v_community_id IS NULL THEN
    INSERT INTO communities (created_by_profile_id, community_name, access_type)
    VALUES (v_provider_id, 'Test Community', 'invite_only')
    RETURNING id INTO v_community_id;
    RAISE NOTICE '  → created community %', v_community_id;
  ELSE
    RAISE NOTICE '  → community % already exists', v_community_id;
  END IF;

  -- Add customer (provider is auto-added by trigger)
  INSERT INTO community_members (community_id, profile_id, member_role, membership_status, join_method)
  VALUES (v_community_id, v_customer_id, 'member', 'active', 'direct_invite')
  ON CONFLICT DO NOTHING;
END $$;
SQL

# ── 5. Verify memberships are correct ──────────────────────
psql -tA <<'SQL'
SELECT 'provider: ' || cm.membership_status || ' can_post=' || cm.can_post_offerings
FROM community_members cm
JOIN profiles p ON p.id = cm.profile_id
WHERE p.email = 'test3@kodo.com' AND cm.member_role = 'owner';

SELECT 'customer: ' || cm.membership_status
FROM community_members cm
JOIN profiles p ON p.id = cm.profile_id
WHERE p.email = 'test2@kodo.com';
SQL

# Assert provider has posting rights
HAS_POSTING=$(psql -tA <<'SQL'
SELECT COUNT(*) FROM community_members cm
JOIN profiles p ON p.id = cm.profile_id
WHERE p.email = 'test3@kodo.com'
  AND cm.membership_status = 'active'
  AND cm.can_post_offerings = true;
SQL
)
if [ "$HAS_POSTING" != "1" ]; then
  echo "  ✗ Provider doesn't have active membership with can_post_offerings=true"
  exit 1
fi

echo "→ Seed complete"
