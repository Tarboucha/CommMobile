#!/usr/bin/env bash
# Create a new Prisma migration for Supabase
# Usage: ./scripts/create-migration.sh <migration_name>
#
# Example: ./scripts/create-migration.sh add_loan_fields
#
# This uses `prisma migrate diff --from-config-datasource` instead of
# `prisma migrate dev` because Supabase's auth schema has generated columns
# that don't replay cleanly on Prisma's shadow database.

set -e

if [ -z "$1" ]; then
  echo "Error: migration name required"
  echo "Usage: $0 <migration_name>"
  echo "Example: $0 add_loan_fields"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_NAME="${TIMESTAMP}_$1"
MIGRATION_DIR="prisma/migrations/${MIGRATION_NAME}"

mkdir -p "$MIGRATION_DIR"

npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script \
  -o "${MIGRATION_DIR}/migration.sql"

if [ ! -s "${MIGRATION_DIR}/migration.sql" ]; then
  echo "No schema changes detected. Migration file is empty."
  rm -rf "$MIGRATION_DIR"
  exit 0
fi

echo ""
echo "=== Migration generated: ${MIGRATION_NAME} ==="
echo ""
cat "${MIGRATION_DIR}/migration.sql"
echo ""
echo "=== Review the SQL above ==="
echo "To apply: npx prisma migrate deploy"
echo "To regenerate client: npx prisma generate"
