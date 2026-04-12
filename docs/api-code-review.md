# API Code Review & Recommendations

A comprehensive audit of the `nextserver/src/app/api/` codebase covering architecture, consistency, security, and scalability.

---

## 1. Architecture: Add a Service Layer

**Current state:** Route handlers do everything inline — auth, validation, business logic, DB queries, response formatting. The booking POST handler is 330+ lines.

**Problem:** Business logic is trapped in HTTP handlers, making it untestable without HTTP, unreusable from WebSocket handlers, and hard to reason about.

**Recommendation:** Extract a thin service layer. Route handlers become orchestrators.

```
// Current: everything in the handler
export const POST = withAuth(async (user, request, params) => {
  // 30 lines of validation
  // 50 lines of DB queries
  // 40 lines of business logic
  // 20 lines of response formatting
});

// Proposed: handler → service → DB
export const POST = withAuth(async (user, request) => {
  const input = parseAndValidate(request, bookingCreateSchema);
  const result = await bookingService.create(user, input);
  return successResponse({ booking: result }, undefined, 201);
});
```

**Where to put services:** `nextserver/src/lib/services/` with one file per domain: `booking-service.ts`, `offering-service.ts`, `community-service.ts`.

**What stays in handlers:** Request parsing, calling the service, formatting the response.  
**What moves to services:** Authorization checks, business rules, DB queries, side effects.

### Files most urgently needing extraction

| File | Lines | Why |
|---|---|---|
| `api/bookings/route.ts` (POST) | ~330 | Idempotency + membership + offering fetch + amount calc + RPC + response |
| `api/addresses/route.ts` (POST) | ~170 | Geocoding + default-setting logic + validation |
| `api/addresses/[addressId]/route.ts` (PATCH) | ~140 | Duplicate geocoding logic from POST |

---

## 2. Inconsistent Supabase vs Prisma Usage

**Current state:** Some routes use Supabase client (RLS-enforced), others use Prisma (direct, no RLS), and some mix both in the same handler.

### The problem

```typescript
// api/bookings/route.ts
const supabase = await createClient();  // ← creates server client, uses header-based auth
const { data: membership } = await supabase.from("community_members")...  // RLS

// ... later in same handler ...
const newBooking = await prisma.bookings.findUnique({ where: { id } });  // no RLS
```

The Supabase queries go through RLS (good for security), but the Prisma queries bypass it entirely. In the same handler, this creates an inconsistent security boundary.

### Recommendation: Pick one strategy

**Option A (recommended): Prisma everywhere + explicit authorization**
- All DB access through Prisma (direct connection, no RLS)
- Authorization enforced explicitly in service layer: `assertBookingParty(booking, userId)`
- Supabase client used ONLY for auth (JWT verification) and RPC calls
- Consistent, testable, no hidden RLS surprises

**Option B: Supabase for reads, Prisma/RPC for writes**
- Read queries through Supabase (RLS protects data access)
- Writes through Prisma or SECURITY DEFINER RPCs (need atomic operations)
- Document this convention clearly

The current mix of both without a clear convention is the worst option.

### Specific security concern

`api/bookings/route.ts:38` uses `await createClient()` which creates a server-side Supabase client from `headers()`. But `createClientFromRequest(request)` extracts the Bearer token directly. The `withSecureAuth` wrapper uses `createClientFromRequest`, so the handler-level `await createClient()` may create a different session context. This should be unified.

---

## 3. Repeated Code Patterns to Extract

### 3a. Membership check (5+ routes)

```typescript
// Repeated in: bookings/route.ts, communities/offerings, community members, board, posts
const membership = await prisma.community_members.findFirst({
  where: { community_id, profile_id: user.id, membership_status: "active" },
});
if (!membership) return ApiErrors.notCommunityMember();
```

**Extract to:**
```typescript
// lib/services/authorization.ts
export async function assertCommunityMember(
  communityId: string, userId: string, requiredRoles?: string[]
): Promise<CommunityMember> {
  const member = await prisma.community_members.findFirst({...});
  if (!member) throw new AuthorizationError("NOT_COMMUNITY_MEMBER");
  if (requiredRoles && !requiredRoles.includes(member.member_role)) {
    throw new AuthorizationError("INSUFFICIENT_ROLE");
  }
  return member;
}
```

### 3b. Offering ownership check (4 routes)

```typescript
// Repeated in: offerings/[id] PATCH, DELETE; schedules POST; schedules/[id] PATCH, DELETE
const offering = await prisma.offerings.findFirst({
  where: { id: offeringId, deleted_at: null },
  select: { id: true, provider_id: true },
});
if (!offering) return ApiErrors.notFound("Offering");
if (offering.provider_id !== user.id) return ApiErrors.forbidden("...");
```

Only `schedules/[scheduleId]/route.ts` extracts this into `verifyScheduleOwnership()` — the rest are inline.

**Extract to:**
```typescript
export async function assertOfferingOwner(offeringId: string, userId: string) {
  const offering = await prisma.offerings.findFirst({...});
  if (!offering) throw new NotFoundError("Offering");
  if (offering.provider_id !== userId) throw new ForbiddenError("...");
  return offering;
}
```

### 3c. Booking party check (4 routes)

```typescript
const isCustomer = booking.customer_id === user.id;
const isProvider = booking.provider_id === user.id;
if (!isCustomer && !isProvider) return ApiErrors.forbidden("...");
```

### 3d. JSON body parsing (12+ routes)

```typescript
let rawData: Record<string, unknown>;
try {
  rawData = await request.json();
} catch {
  return ApiErrors.badRequest("Invalid JSON in request body");
}
```

**Extract to a `withValidation` wrapper or helper:**
```typescript
export async function parseJsonBody<T>(
  request: NextRequest, schema: z.ZodType<T>
): Promise<T> {
  let raw;
  try { raw = await request.json(); } catch { throw new ValidationError("Invalid JSON"); }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(parseZodError(result.error));
  return result.data;
}
```

### 3e. Schedule date/time conversion (2 routes)

```typescript
dtstart: new Date(`${input.dtstart}T00:00:00Z`),
start_time: new Date(`1970-01-01T${input.start_time}:00Z`),
```

**Extract to:**
```typescript
export function dateFromYMD(ymd: string): Date { return new Date(`${ymd}T00:00:00Z`); }
export function timeFromHHMM(hhmm: string): Date { return new Date(`1970-01-01T${hhmm}:00Z`); }
```

---

## 4. Error Handling Gaps

### 4a. RPC errors not consistently parsed

`api/bookings/route.ts` correctly parses RPC error messages:
```typescript
if (msg.includes("Not enough slots")) return ApiErrors.slotsUnavailable(...);
if (msg.includes("version mismatch")) return ApiErrors.conflict(...);
```

But `api/bookings/[bookingId]/items/[itemId]/return/route.ts` does NOT — it returns a generic 500 for all RPC failures, even user-facing ones like "item already returned."

**Fix:** Create a shared `handleRpcError(error)` helper that maps known RPC exception messages to user-friendly API errors.

### 4b. Prisma errors not logged with context

Multiple routes catch Prisma errors and return `ApiErrors.serverError()` with no details:
```typescript
} catch (error) {
  console.error("Error fetching booking details:", error);
  return ApiErrors.serverError();
}
```

The `console.error` is good but loses context — which query, which entity, what IDs. 

**Fix:** Structured error logging:
```typescript
console.error("[bookings:GET] Failed to fetch booking details", {
  bookingId, userId: user.id, error: (error as Error).message
});
```

### 4c. Missing param validation in some routes

Some dynamic routes validate params, others don't:
- **Has validation:** `bookings/[bookingId]/offers/route.ts:43-44`
- **Missing validation:** Some schedule routes assume `offeringId`/`scheduleId` exist without null checks

Should be enforced in all routes, or better: extracted into the `withAuth` wrapper for dynamic routes.

---

## 5. Response Format Inconsistencies

### 5a. Inconsistent `message` parameter

```typescript
successResponse({ booking }, "Booking created successfully", 201);  // with message
successResponse({ schedule: schedule as any }, undefined, 201);     // undefined message
successResponse({ booking: updatedBooking as any });                // no message
```

**Recommendation:** Drop the optional `message` field from `successResponse`. The `success: true` flag is sufficient. If a message is needed, put it in `data`.

### 5b. Heavy use of `as any` casts

Found in 15+ locations:
```typescript
return successResponse({ booking: newBooking as any });
return successResponse({ offers: offers as any });
return successResponse({ schedule: schedule as any });
```

**Root cause:** Prisma returns `Decimal` types for monetary columns, and the `serialize()` helper converts them. But TypeScript doesn't know about the transformation, so `as any` is used to suppress type errors.

**Fix:** Define response types that match the serialized shape (numbers instead of Decimal) and use them:
```typescript
type BookingResponse = Omit<bookings, 'total_amount'> & { total_amount: number };
return successResponse({ booking: serialize(newBooking) as BookingResponse });
```

---

## 6. Security Observations

### 6a. GET endpoints for sensitive data use `withAuth` not `withSecureAuth`

- `GET /api/bookings` — lists user's bookings (financial data)
- `GET /api/bookings/:id` — booking detail with customer/provider info
- `GET /api/addresses` — user's physical addresses
- `GET /api/conversations/:id/messages` — private messages

All use `withAuth` (fast JWT claims check). For a mobile app where tokens can be stolen, consider upgrading sensitive reads to `withSecureAuth` (server-verified session).

**Counter-argument:** `withSecureAuth` adds latency. For reads, the risk is lower (no mutation). Acceptable trade-off for most apps, but document the decision.

### 6b. No rate limiting

`ApiErrors.rateLimited()` exists but is never used. No middleware applies rate limits.

**Minimum:** Add per-user rate limiting to write endpoints (booking creation, message sending, offer submission). Use a simple in-memory counter for dev, Upstash Redis for production.

### 6c. Debug logging in production

`api/addresses/[addressId]/route.ts` has debug console.logs:
```typescript
console.log("[Address PATCH] Raw request data:", {...});
```

Remove or gate behind `NODE_ENV === 'development'`.

---

## 7. Missing Infrastructure

### 7a. No request ID tracking

Every request should get a unique ID (UUID or nanoid) attached in the auth wrapper, logged with every action, and returned in the response headers (`X-Request-Id`). Essential for debugging mobile user reports.

### 7b. No API versioning

All routes are at `/api/...` with no version prefix. Once the mobile app is in the App Store, you can't change response shapes without breaking old clients. 

**Minimum:** Add `/api/v1/` prefix now, before shipping. Easier to add a v2 later.

### 7c. No request duration logging

The auth wrappers don't track how long requests take. Add `Date.now()` at the start, log duration at the end. This catches slow queries before they become user-visible.

### 7d. No structured logging

`console.log` / `console.error` with string messages. Should use structured JSON logging (pino) for production:
```json
{"level":"info","requestId":"abc","userId":"xyz","route":"POST /api/bookings","duration":142,"status":201}
```

---

## 8. Proposed File Structure

```
nextserver/src/
├── app/api/                    # Route handlers (thin orchestrators)
│   └── bookings/route.ts      # Parse input, call service, format response
├── lib/
│   ├── services/               # Business logic (NEW)
│   │   ├── booking-service.ts  # create, updateStatus, returnLoan
│   │   ├── offering-service.ts # create, update, delete
│   │   ├── community-service.ts
│   │   └── offer-service.ts    # counter, accept, decline
│   ├── guards/                 # Authorization helpers (NEW)
│   │   ├── assert-community-member.ts
│   │   ├── assert-offering-owner.ts
│   │   └── assert-booking-party.ts
│   ├── utils/
│   │   ├── api-route-helper.ts # withAuth, withSecureAuth
│   │   ├── api-response.ts     # successResponse, ApiErrors
│   │   ├── parse-request.ts    # parseJsonBody (NEW)
│   │   ├── date-helpers.ts     # dateFromYMD, timeFromHHMM (NEW)
│   │   └── rpc-errors.ts       # handleRpcError (NEW)
│   ├── validations/            # Zod schemas (unchanged)
│   └── prisma.ts               # Prisma client singleton
```

---

## 9. Priority Matrix

| Priority | Issue | Impact | Effort |
|---|---|---|---|
| **P0** | Unify Supabase/Prisma usage + fix `createClient()` security gap | Security | Medium |
| **P0** | Remove debug logging from production | Security | Low |
| **P1** | Extract authorization guards (membership, ownership, booking party) | Consistency, DRY | Medium |
| **P1** | Extract `parseJsonBody` + `handleRpcError` helpers | DRY, error quality | Low |
| **P1** | Parse RPC errors consistently across all booking routes | User experience | Low |
| **P2** | Add service layer for booking creation | Maintainability | High |
| **P2** | Add request ID tracking | Debuggability | Low |
| **P2** | Remove `as any` casts with proper response types | Type safety | Medium |
| **P3** | API versioning (`/api/v1/`) | Future-proofing | Medium |
| **P3** | Structured logging (pino) | Observability | Medium |
| **P3** | Rate limiting | Security | Medium |
| **P3** | Request duration logging | Performance visibility | Low |
