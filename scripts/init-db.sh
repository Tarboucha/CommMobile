#!/bin/bash
set -e

# =============================================================================
# Initialize the database from scratch
# Run from project root: ./scripts/init-db.sh
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_USER="kodo"
DB_NAME="kodo"

# Load password from .env
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' "$PROJECT_ROOT/.env" | cut -d'=' -f2)
DB_URL="postgresql://$DB_USER:$POSTGRES_PASSWORD@localhost:5432/$DB_NAME"

echo "══════════════════════════════════════════════════════════"
echo " 1. Wipe and restart Docker stack"
echo "══════════════════════════════════════════════════════════"
cd "$PROJECT_ROOT"
docker compose down -v
docker compose up --build -d
echo "Waiting for containers..."
sleep 15

# Wait for postgres to be healthy
until docker exec kodo-postgres pg_isready -U $DB_USER -q 2>/dev/null; do
  echo "  waiting for postgres..."
  sleep 2
done
echo "  postgres ready"

echo ""
echo "══════════════════════════════════════════════════════════"
echo " 2. Install extensions"
echo "══════════════════════════════════════════════════════════"
docker exec -i kodo-postgres psql -U $DB_USER -d $DB_NAME <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS dblink;
SQL
echo "  done"

echo ""
echo "══════════════════════════════════════════════════════════"
echo " 3. Prisma schema push (creates all tables)"
echo "══════════════════════════════════════════════════════════"
cd "$PROJECT_ROOT/nextserver"
DATABASE_URL="$DB_URL" npx prisma db push --accept-data-loss
echo "  done"

echo ""
echo "══════════════════════════════════════════════════════════"
echo " 4. Apply functions + triggers"
echo "══════════════════════════════════════════════════════════"
docker exec -i kodo-postgres psql -U $DB_USER -d $DB_NAME < "$PROJECT_ROOT/db/functions.sql"
echo "  done"

echo ""
echo "══════════════════════════════════════════════════════════"
echo " 5. Verify"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Services:"
curl -s http://localhost:3004/health && echo ""
curl -s http://localhost:3002/api/v1/health && echo ""
echo ""

FUNC_COUNT=$(docker exec -i kodo-postgres psql -U $DB_USER -d $DB_NAME -tAc "SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace")
TRIGGER_COUNT=$(docker exec -i kodo-postgres psql -U $DB_USER -d $DB_NAME -tAc "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal")
TABLE_COUNT=$(docker exec -i kodo-postgres psql -U $DB_USER -d $DB_NAME -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")

echo "  Tables:    $TABLE_COUNT"
echo "  Functions: $FUNC_COUNT"
echo "  Triggers:  $TRIGGER_COUNT"
echo ""
echo "══════════════════════════════════════════════════════════"
echo " DB READY"
echo "══════════════════════════════════════════════════════════"
