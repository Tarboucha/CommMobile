#!/bin/bash
set -e

# =============================================================================
# Migrate from Supabase to self-hosted PostgreSQL + custom auth-service
#
# Prerequisites:
#   - Docker stack is DOWN (docker compose down -v)
#   - .env has POSTGRES_PASSWORD and DATABASE_URL set with matching passwords
#   - auth-service/pnpm-lock.yaml exists (run: cd auth-service && pnpm install)
#   - supabase-data.sql exists (run the pg_dump command below first)
# =============================================================================

SUPABASE_CONN="postgresql://postgres.hcawgxvhzabezhcmwale:YOUR_PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
LOCAL_DB_USER="kodo"
LOCAL_DB_NAME="kodo"

echo "═══════════════════════════════════════════════════════════"
echo " Step 0: Export data from Supabase (data only, INSERT format)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "If you haven't done this yet, run:"
echo ""
echo "  /usr/lib/postgresql/17/bin/pg_dump \\"
echo "    --no-owner --no-acl --schema=public \\"
echo "    --data-only --inserts \\"
echo "    \"$SUPABASE_CONN\" \\"
echo "    > supabase-data.sql"
echo ""

if [ ! -f supabase-data.sql ]; then
  echo "ERROR: supabase-data.sql not found. Run the pg_dump command above first."
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo " Step 1: Start fresh Docker stack"
echo "═══════════════════════════════════════════════════════════"
docker compose down -v 2>/dev/null || true
docker compose up -d
echo "Waiting for containers to be healthy..."
sleep 15

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 2: Install PostgreSQL extensions"
echo "═══════════════════════════════════════════════════════════"
docker exec -i kodo-postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SQL
echo "Extensions installed."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 3: Push Prisma schema (creates all public.* tables)"
echo "═══════════════════════════════════════════════════════════"
cd nextserver
# Prisma needs localhost URL (not Docker internal hostname)
LOCAL_PASSWORD=$(grep POSTGRES_PASSWORD ../.env | cut -d'=' -f2)
DATABASE_URL="postgresql://$LOCAL_DB_USER:$LOCAL_PASSWORD@localhost:5432/$LOCAL_DB_NAME" npx prisma db push --accept-data-loss
cd ..
echo "Prisma schema pushed."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 4: Import Supabase data"
echo "═══════════════════════════════════════════════════════════"
docker exec -i kodo-postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < supabase-data.sql
echo "Data imported."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 5: Restart auth-service (recreates auth.* tables)"
echo "═══════════════════════════════════════════════════════════"
docker compose restart auth-service
sleep 10
echo "Auth service restarted."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 6: Migrate Supabase users → auth.users"
echo "═══════════════════════════════════════════════════════════"
echo "NOTE: This step requires the Supabase auth.users data."
echo "If you exported auth schema too, run:"
echo ""
echo "  docker exec -i kodo-postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < auth-service/sql/002_migrate_supabase_users.sql"
echo ""

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Step 7: Verify"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  curl http://localhost:3004/health          # auth-service"
echo "  curl http://localhost:3002/api/v1/health   # kodo-api"
echo "  curl http://localhost:3004/.well-known/jwks.json  # JWKS"
echo ""
echo "  # Row counts"
echo "  docker exec -i kodo-postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c 'SELECT count(*) FROM public.profiles;'"
echo ""
echo "  # E2E tests"
echo "  cd nextserver && npx tsx scripts/test-booking-e2e.ts"
echo "  cd nextserver && npx tsx scripts/test-socket-e2e.ts"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo " MIGRATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
