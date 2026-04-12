# Prisma Migration Workflow (Supabase)

## Overview

This project uses Prisma ORM with a Supabase Postgres database. Because Supabase's `auth` schema contains generated columns that don't replay cleanly on Prisma's shadow database, we **cannot use `prisma migrate dev`**. Instead, we use `prisma migrate diff` to generate migrations against the live database directly.

---

## How It Works

### Connection setup

- **`DATABASE_URL`** — points to Supabase's **session pooler** (`aws-*.pooler.supabase.com:5432`). Used by the runtime Prisma client AND by migration commands. Supports DDL, LISTEN/NOTIFY, prepared statements — everything.
- **`DIRECT_URL`** — not needed. The session pooler handles all operations. If you add it, it must also point to the session pooler (not the direct `db.*.supabase.co` host, which is IPv6-only and unreachable from most machines).

### Prisma client vs CLI

| | Uses | Via |
|---|---|---|
| **Runtime queries** (API routes) | `DATABASE_URL` | `src/lib/prisma.ts` with `PrismaPg` adapter |
| **Migration CLI** (`prisma migrate`, `prisma db pull`) | `DATABASE_URL` via `prisma.config.ts` | `prisma.config.ts` reads `DIRECT_URL` first, falls back to `DATABASE_URL` |

### Why `prisma migrate dev` doesn't work

`migrate dev` uses a "shadow database" — a temporary DB where Prisma replays all migrations from scratch to detect drift. Supabase's `auth` schema has:
- Generated columns with expressions (e.g., `identities.email`, `users.confirmed_at`)
- Complex triggers that reference system schemas
- RLS policies that require Supabase-specific functions

These don't replay cleanly on a blank shadow DB, so `migrate dev` errors out. The workaround is to **skip the shadow DB entirely** by generating migrations with `migrate diff --from-config-datasource`, which compares against the live database instead.

---

## Making a Schema Change

### Step 1: Edit `prisma/schema.prisma`

Make your change — add a column, create a table, modify a type, etc.

```prisma
model profiles {
  id    String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  // ... existing fields
  loan_duration_days  Int?    // ← new field
}
```

### Step 2: Generate the migration

Use the helper script:

```bash
cd nextserver
./scripts/create-migration.sh add_loan_duration
```

This runs:
```bash
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script \
  -o prisma/migrations/<timestamp>_add_loan_duration/migration.sql
```

It compares the current state of the live database against your updated `schema.prisma` and writes a `migration.sql` file containing only the diff (e.g., `ALTER TABLE profiles ADD COLUMN...`).

The script prints the generated SQL so you can review it.

### Step 3: Review the SQL

Always read the generated SQL before applying it. Look for:
- Unexpected `DROP` statements (might mean you accidentally removed something from the schema)
- Missing constraints or defaults
- Column type changes that could break existing data

If the SQL looks wrong, edit `prisma/schema.prisma` and regenerate:
```bash
rm -rf prisma/migrations/<timestamp>_add_loan_duration
./scripts/create-migration.sh add_loan_duration
```

### Step 4: Apply the migration

```bash
npx prisma migrate deploy
```

This runs all pending migrations against the live database. It's idempotent — safe to run multiple times.

### Step 5: Regenerate the Prisma client

```bash
npx prisma generate
```

This updates the TypeScript types in `src/generated/prisma/` so your code can use the new fields.

---

## Rolling Back a Migration

Prisma doesn't have a built-in rollback command. To undo a change:

1. Edit `prisma/schema.prisma` to remove the field/table
2. Run `./scripts/create-migration.sh remove_loan_duration`
3. Review and apply: `npx prisma migrate deploy`
4. Regenerate: `npx prisma generate`

This creates a new migration that reverses the previous one. The forward migration stays in history (you don't delete it).

---

## Baseline (One-Time Setup)

This was already done — documented here for reference only.

The database existed before Prisma was added, so we had to "baseline" it: create an `0_init` migration representing the current schema and mark it as applied without actually running it.

```bash
# 1. Create baseline migration folder
mkdir -p prisma/migrations/0_init

# 2. Generate baseline SQL from current schema
npx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script \
  -o prisma/migrations/0_init/migration.sql

# 3. Mark it as already applied (don't actually run it)
npx prisma migrate resolve --applied 0_init
```

After this, the `_prisma_migrations` table in the DB knows `0_init` is done, and future migrations start from there.

---

## CI/CD Integration

For automated deployments, migrations should run in CI, not on the VPS:

```yaml
# .github/workflows/deploy.yml (example)
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install

      # Apply any pending migrations (idempotent)
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      # Generate client (needed for build)
      - run: npx prisma generate

      # Build and deploy
      - run: pnpm build
      - name: Deploy to VPS
        run: rsync -avz .next/ user@vps:/path/to/app/
```

**Security note:** The CI secret `DATABASE_URL` has DDL permissions. The VPS's `DATABASE_URL` could theoretically use a restricted Postgres role with only `SELECT/INSERT/UPDATE/DELETE` grants (no DDL) for defense in depth. See [prisma-integration-plan.md](prisma-integration-plan.md) for the full role separation strategy.

---

## Schema Drift Detection

If someone makes changes directly to the database (via Supabase dashboard, SQL editor, or another tool), your Prisma schema becomes out of sync. To detect and fix drift:

```bash
# Re-introspect the live DB into schema.prisma
npx prisma db pull

# Review changes to schema.prisma (git diff)
git diff prisma/schema.prisma

# If the changes are expected, commit them
# If unexpected, investigate who changed what
```

`prisma db pull` overwrites `schema.prisma` with what's actually in the database. Use this to sync Prisma back to reality when drift happens.

---

## Common Commands Cheat Sheet

| Command | Purpose |
|---------|---------|
| `./scripts/create-migration.sh <name>` | Create a new migration from schema changes |
| `npx prisma migrate deploy` | Apply pending migrations to the database |
| `npx prisma migrate status` | Show which migrations are pending/applied |
| `npx prisma generate` | Regenerate the Prisma client (types) |
| `npx prisma db pull --force` | Re-introspect live DB, overwrite schema.prisma |
| `npx prisma validate` | Validate schema.prisma syntax |
| `npx prisma format` | Auto-format schema.prisma |

### Commands to avoid

| Command | Why not |
|---------|---------|
| `npx prisma migrate dev` | Uses shadow DB, fails on Supabase's `auth` schema |
| `npx prisma db push` | Bypasses migration history — dangerous in prod |
| `npx prisma migrate reset` | Wipes the DB and re-runs all migrations — data loss |

---

## Troubleshooting

### "Migration failed to apply cleanly to the shadow database"
You used `migrate dev` instead of the diff-based workflow. Use `./scripts/create-migration.sh` instead.

### "No migration found in prisma/migrations"
You haven't baselined the database yet. See [Baseline](#baseline-one-time-setup) above.

### "Drift detected"
Someone changed the DB outside of Prisma. Run `npx prisma db pull` to sync your schema, review the diff, and commit if the changes are intentional.

### Cannot reach database server at `db.*.supabase.co:5432`
You're trying to use the direct connection, which is IPv6-only on Supabase. Use the session pooler URL (`aws-*.pooler.supabase.com:5432`) instead.

### Migration file is empty
Either the schema hasn't changed, or `prisma.config.ts` isn't loading the `DATABASE_URL` correctly. Verify with:
```bash
npx prisma migrate status
```

---

## Files

- `prisma/schema.prisma` — the single source of truth for your schema
- `prisma/migrations/` — committed migration history (never edit applied migrations)
- `prisma.config.ts` — CLI configuration (points to `DATABASE_URL`)
- `src/lib/prisma.ts` — runtime Prisma client singleton
- `scripts/create-migration.sh` — helper for generating migrations
- `.env` — contains `DATABASE_URL` (not committed)
