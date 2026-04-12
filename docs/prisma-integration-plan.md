# Prisma Integration Plan — nextserver

## Current State

- All DB access goes through **Supabase client** (PostgREST REST API)
- Auth uses JWT tokens from Authorization headers (mobile-first, no cookies)
- Atomic operations use **Supabase RPC** calls to SECURITY DEFINER functions
- Type safety from auto-generated Supabase types (`types/supabase.ts`)
- Real-time via `pg-notify` listeners + Socket.io (uses raw `pg.Client` with direct Postgres connection)
- Zod for request validation
- `DATABASE_URL` already exists for pg-notify — Prisma will share it

## Why Prisma

- **Type-safe schema** — single source of truth, auto-generated client
- **Migrations** — `prisma migrate` handles schema changes cleanly (critical for the offerings redesign + loan model)
- **Transactions** — `prisma.$transaction()` replaces complex RPC functions
- **Relations** — auto-loading relations instead of manual `.select("*, profiles!provider_id(...)")` strings
- **Better DX** — autocomplete, compile-time errors, no more raw query strings

## What Stays the Same

- **Auth** — JWT extraction from headers, `withAuth` middleware (unchanged)
- **Zod validation** — keep all request validation schemas
- **Socket.io + pg-notify** — real-time layer uses raw `pg.Client`, unaffected by Prisma
- **API response helpers** — `successResponse`, `ApiErrors` (unchanged)
- **Supabase Auth** — keep `@supabase/supabase-js` for `supabase.auth.*` only (login, signup, token refresh)

---

## Connection Setup

### DB Roles (security)

Two Postgres roles to enforce least-privilege:

| Role | Used by | Permissions |
|---|---|---|
| `app_server` | Prisma + pg-notify on VPS (runtime) | SELECT, INSERT, UPDATE, DELETE only. **No DDL** (cannot CREATE/ALTER/DROP tables) |
| `postgres` | Prisma migrate in CI (migrations only) | Full DDL + data access |

This protects against SQL injection or server bugs — even if the VPS is compromised, the attacker cannot alter the schema or drop tables.

**Create the `app_server` role in Supabase SQL editor:**
```sql
-- Create restricted role for the app server
CREATE ROLE app_server WITH LOGIN PASSWORD 'secure_password';

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO app_server;

-- Grant data operations only (no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_server;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_server;

-- Auto-grant on future tables created by migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_server;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_server;

-- Allow LISTEN for pg-notify
GRANT CONNECT ON DATABASE postgres TO app_server;
```

### Environment Variables

```env
# VPS (.env) — restricted role, data operations only
DATABASE_URL="postgresql://app_server:[password]@db.[ref].supabase.co:5432/postgres"

# CI only — full permissions for schema migrations (never on VPS)
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```

### Prisma Config

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // app_server role (runtime)
  directUrl = env("DIRECT_URL")         // postgres role (migrations, CI only)
}
```

At runtime on VPS, `DIRECT_URL` is not set — Prisma falls back to `DATABASE_URL` which is fine since the VPS never runs migrations.

### CI/CD Pipeline

```
Developer pushes code
        ↓
   CI/CD Pipeline
   ┌──────────────────────────────────────┐
   │  1. pnpm install                     │
   │  2. npx prisma generate              │
   │  3. npx prisma migrate deploy        │  ← uses DIRECT_URL (postgres role)
   │  4. pnpm build                       │
   │  5. Deploy to VPS                    │
   └──────────────────────────────────────┘
        ↓
   VPS (production)
   ┌──────────────────────────────────────┐
   │  DATABASE_URL (app_server role):     │
   │  - Prisma client (app queries)       │
   │  - pg.Client (LISTEN/NOTIFY)         │
   │                                      │
   │  DIRECT_URL: not set (no migrations) │
   │  Supabase Auth: sb_publishable key   │
   └──────────────────────────────────────┘
```

### What each role can do

```
app_server (VPS):
  ✅ SELECT, INSERT, UPDATE, DELETE
  ✅ LISTEN/NOTIFY (pg-notify)
  ✅ Use sequences (auto-increment IDs)
  ❌ CREATE TABLE / ALTER TABLE / DROP TABLE
  ❌ CREATE FUNCTION / DROP FUNCTION
  ❌ GRANT / REVOKE permissions

postgres (CI):
  ✅ Everything above
  ✅ Schema migrations (DDL)
  ✅ Create/modify functions and triggers
```

---

## Phase 1: Setup

### 1a. Install dependencies
```bash
cd nextserver
pnpm add @prisma/client
pnpm add -D prisma
```

### 1b. Verify DATABASE_URL
Already exists in `.env` for pg-notify. Verify it's a direct connection (port 5432, not 6543).

### 1c. Introspect existing DB
```bash
npx prisma db pull
```

Generates `prisma/schema.prisma` from the existing Supabase tables, enums, relations, and constraints. The existing DB becomes the baseline — no data changes.

### 1d. Generate Prisma client
```bash
npx prisma generate
```

### 1e. Create Prisma client singleton

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Singleton pattern prevents connection pool exhaustion during dev hot reload.

### 1f. Add generate to build script

```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

---

## Phase 2: Incremental Migration (route by route)

Migrate routes from Supabase client to Prisma **one at a time**. Both coexist during the transition.

### Migration priority (simplest first)

| Priority | Route | Complexity | Notes |
|----------|-------|-----------|-------|
| 1 | `GET /api/addresses` | Simple | Basic CRUD, good first test |
| 2 | `POST /api/addresses` | Simple | INSERT with geocoding |
| 3 | `GET /api/profiles/[id]` | Simple | Single record fetch |
| 4 | `PATCH /api/profiles/[id]` | Simple | Single record update |
| 5 | `GET /api/notifications` | Simple | Paginated list with filters |
| 6 | `GET /api/communities` | Medium | Pagination + membership checks |
| 7 | `GET /api/communities/[id]/offerings` | Medium | Pagination + joins |
| 8 | `GET /api/communities/[id]/board` | Medium | Merged feed (posts + offerings) |
| 9 | `POST /api/bookings` | Complex | Atomic RPC → Prisma $transaction |
| 10 | `PATCH /api/bookings/[id]` | Complex | Status updates + snapshots |

### What a migration looks like

**Before (Supabase client):**
```typescript
const supabase = await createClient();
const { data, error } = await supabase
  .from("addresses")
  .select("*")
  .eq("profile_id", user.id)
  .is("deleted_at", null)
  .order("is_default", { ascending: false });

if (error) return ApiErrors.serverError();
return successResponse({ addresses: data });
```

**After (Prisma):**
```typescript
import { prisma } from '@/lib/prisma';

const addresses = await prisma.address.findMany({
  where: { profile_id: user.id, deleted_at: null },
  orderBy: { is_default: 'desc' },
});

return successResponse({ addresses });
```

### Relations example

**Before (Supabase — string-based joins):**
```typescript
const { data } = await supabase
  .from("offerings")
  .select("*, profiles!provider_id(id, first_name, last_name, avatar_url)")
  .eq("community_id", communityId);
```

**After (Prisma — typed includes):**
```typescript
const offerings = await prisma.offering.findMany({
  where: { community_id: communityId, deleted_at: null, status: 'active' },
  include: {
    provider: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
  },
});
```

---

## Phase 3: Replace RPC with Prisma Transactions

The booking creation RPC (`create_booking_with_items`) is the most complex migration.

**Before (Supabase RPC):**
```typescript
const { data, error } = await supabase.rpc("create_booking_with_items", {
  p_booking: bookingData,
  p_items: itemsData,
});
```

**After (Prisma interactive transaction):**
```typescript
const booking = await prisma.$transaction(async (tx) => {
  // 1. Check offering versions (optimistic lock)
  // 2. Reserve slots (FOR UPDATE via tx.$queryRaw)
  // 3. Create booking
  // 4. Create booking items
  // 5. Create snapshots
  // All atomic — rolls back on any failure
});
```

**Note:** Some operations need raw SQL within Prisma (e.g., `FOR UPDATE` locks). Prisma supports this via `tx.$queryRaw` and `tx.$executeRaw`.

### RPC functions to replace

| Current RPC | Prisma replacement |
|---|---|
| `create_booking_with_items` | `prisma.$transaction()` with slot reservation logic |
| `create_direct_conversation` | `prisma.$transaction()` — create conversation + participants atomically |
| `join_community_via_invite_link` | `prisma.$transaction()` — validate token + add member |
| `return_loan_item` (new) | `prisma.$transaction()` — validate + release slots + update status |

---

## Phase 4: Handle RLS Transition

**Current:** Supabase client respects RLS policies. Queries are automatically filtered by the authenticated user.

**With Prisma:** Direct DB connection bypasses RLS. Authorization must be enforced in application code.

**This is already mostly the case** — the `withAuth` middleware extracts the user, and most routes check permissions explicitly:
```typescript
export const GET = withAuth(async (user, request, params) => {
  const data = await prisma.address.findMany({
    where: { profile_id: user.id },  // ← replaces RLS
  });
});
```

### Audit checklist per route
- [ ] `where` clause filters by `user.id` (replaces RLS SELECT policies)
- [ ] Mutation routes check ownership/membership before updating (replaces RLS UPDATE/DELETE policies)
- [ ] Admin routes verify `member_role` before allowing operations
- [ ] No route exposes data from other users without proper checks

---

## Phase 5: Remove Supabase Client for DB (keep for Auth)

Once all routes are migrated:
1. Remove DB-related Supabase client usage
2. Keep `@supabase/supabase-js` for `supabase.auth.*` (login, signup, token refresh, session management)
3. Remove auto-generated `types/supabase.ts` — Prisma generates its own types
4. Simplify `src/lib/supabase/server.ts` to auth-only usage

**Final dependency split:**
- `@supabase/supabase-js` → auth only
- `@prisma/client` → all DB queries
- `pg` → pg-notify listeners (unchanged)

---

## Phase 6: Schema Changes via Prisma Migrate

Once Prisma is the source of truth, use it for all future schema changes:

```bash
# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name "add_loan_fields"    # dev: creates + applies migration
npx prisma migrate deploy                           # prod/CI: applies pending migrations
npx prisma generate                                 # regenerate client types
```

This is where the **offerings redesign** and **loan model** migrations happen — managed cleanly via Prisma.

---

## Files Summary

### Files to Create
- `prisma/schema.prisma` — generated by `prisma db pull`, then maintained manually
- `src/lib/prisma.ts` — Prisma client singleton

### Files to Modify
- `.env` / `.env.prod` — verify `DATABASE_URL` is direct connection (port 5432)
- `package.json` — add prisma dependencies + build script update
- Every API route file (incrementally, one at a time)
- `src/lib/supabase/server.ts` — eventually reduce to auth-only usage

### Files to Eventually Remove
- `src/types/supabase.ts` — replaced by Prisma generated types

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing queries during migration | Migrate one route at a time, test each before moving on |
| RLS bypass with Prisma | Audit every route for proper `where` clauses matching old RLS policies |
| Connection pool exhaustion | Singleton pattern + Prisma connection pool config |
| Complex RPC migration | Keep RPCs running in parallel until Prisma transactions are proven |
| pg-notify breaks | pg-notify uses raw `pg` client — completely unaffected by Prisma migration |

---

## Open Questions

1. Should we add `prisma generate` as a postinstall script or only in build?
2. For the booking RPC migration — keep the SECURITY DEFINER function as a fallback during transition, or replace entirely?
3. Should Prisma logging be enabled in dev for query debugging (`log: ['query']`)?
4. Should we create a dedicated Postgres role for Prisma with limited permissions, or use the existing `postgres` role?
