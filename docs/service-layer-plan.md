# Service Layer Plan

## Goal

Extract ~1,500 lines of business logic from 40+ route handlers into a structured service layer. Route handlers become thin orchestrators (parse → call service → respond). Business logic becomes testable, reusable, and auditable.

---

## File Structure

```
nextserver/src/lib/
├── services/
│   ├── booking-service.ts        # Booking creation, status transitions, loan returns
│   ├── offer-service.ts          # Price negotiation: counter, accept, decline, expiry
│   ├── offering-service.ts       # Offering CRUD, schedule management, time-slot queries
│   ├── community-service.ts      # Community CRUD, membership, invitations, invite links
│   ├── conversation-service.ts   # Direct + booking conversations, messaging
│   ├── address-service.ts        # Address CRUD + Nominatim geocoding
│   ├── notification-service.ts   # Notification CRUD + creation helper
│   ├── profile-service.ts        # Profile updates, avatar upload/delete with storage retry
│   └── board-service.ts          # Board feed (merged offerings + posts), pinning
├── guards/
│   ├── assert-community-member.ts
│   ├── assert-offering-owner.ts
│   ├── assert-booking-party.ts
│   └── assert-resource-owner.ts
├── errors/
│   └── domain-errors.ts          # NotFoundError, ForbiddenError, ConflictError, etc.
├── utils/
│   ├── api-route-helper.ts       # withAuth, withSecureAuth (unchanged)
│   ├── api-response.ts           # successResponse, ApiErrors (unchanged)
│   ├── parse-request.ts          # parseJsonBody<T>(request, zodSchema) (NEW)
│   ├── date-helpers.ts           # dateFromYMD, timeFromHHMM, formatTime (NEW)
│   ├── rpc-errors.ts             # mapRpcError(error) → domain error (NEW)
│   └── pagination.ts             # existing cursor helpers (unchanged)
```

---

## Domain Errors

All services throw domain errors instead of returning HTTP responses. Route handlers catch and map them.

```typescript
// lib/errors/domain-errors.ts

export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class InsufficientSlotsError extends DomainError {
  constructor(message = 'Not enough slots available') {
    super('SLOTS_UNAVAILABLE', message);
  }
}

export class VersionMismatchError extends DomainError {
  constructor(message = 'Resource has been updated, please refresh') {
    super('VERSION_MISMATCH', message);
  }
}

export class NotCommunityMemberError extends DomainError {
  constructor() {
    super('NOT_COMMUNITY_MEMBER', 'You are not a member of this community');
  }
}
```

### Error mapping in route handlers

```typescript
// lib/utils/handle-service-error.ts

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof NotFoundError) return ApiErrors.notFound(err.message);
  if (err instanceof ForbiddenError) return ApiErrors.forbidden(err.message);
  if (err instanceof ConflictError) return ApiErrors.conflict(err.message);
  if (err instanceof ValidationError) return ApiErrors.badRequest(err.message);
  if (err instanceof InsufficientSlotsError) return ApiErrors.slotsUnavailable(err.message);
  if (err instanceof VersionMismatchError) return ApiErrors.conflict(err.message);
  if (err instanceof NotCommunityMemberError) return ApiErrors.notCommunityMember();

  // Unknown error — log and return 500
  console.error('[unhandled service error]', err);
  return ApiErrors.serverError();
}
```

---

## Guards (Authorization Helpers)

Extracted from 20+ routes. Each throws a domain error on failure, returns the resource on success.

### `assert-community-member.ts`

```typescript
export async function assertCommunityMember(
  communityId: string,
  userId: string,
  options?: { requiredRoles?: string[]; requireCanPost?: boolean }
): Promise<CommunityMemberRow> {
  const member = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: userId,
      membership_status: 'active',
    },
  });
  if (!member) throw new NotCommunityMemberError();
  if (options?.requiredRoles && !options.requiredRoles.includes(member.member_role)) {
    throw new ForbiddenError('Insufficient role');
  }
  if (options?.requireCanPost && !member.can_post_offerings) {
    throw new ForbiddenError('You do not have permission to post offerings');
  }
  return member;
}
```

Used in: bookings POST, community CRUD, offerings, board, posts, invitations, messages — ~15 routes.

### `assert-offering-owner.ts`

```typescript
export async function assertOfferingOwner(
  offeringId: string,
  userId: string
): Promise<OfferingRow> {
  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
  });
  if (!offering) throw new NotFoundError('Offering');
  if (offering.provider_id !== userId) throw new ForbiddenError('You can only manage your own offerings');
  return offering;
}
```

Used in: offering PATCH, DELETE, schedule POST, schedule PATCH, schedule DELETE — 5 routes.

### `assert-booking-party.ts`

```typescript
export async function assertBookingParty(
  bookingId: string,
  userId: string
): Promise<{ booking: BookingRow; isCustomer: boolean; isProvider: boolean }> {
  const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError('Booking');
  const isCustomer = booking.customer_id === userId;
  const isProvider = booking.provider_id === userId;
  if (!isCustomer && !isProvider) throw new ForbiddenError('You are not a party to this booking');
  return { booking, isCustomer, isProvider };
}
```

Used in: booking GET, PATCH, offers, return, conversation — 5 routes.

### `assert-resource-owner.ts`

```typescript
export async function assertProfileOwner(resourceOwnerId: string, userId: string): void {
  if (resourceOwnerId !== userId) throw new ForbiddenError('You can only manage your own resources');
}
```

Used in: addresses, profiles, notifications — 6+ routes.

---

## Services

### `booking-service.ts`

| Method | Current location | Lines extracted |
|---|---|---|
| `create(user, input)` | `POST /api/bookings` | ~220 |
| `getDetail(bookingId, userId)` | `GET /api/bookings/[id]` | ~60 |
| `updateStatus(bookingId, userId, newStatus, reason?)` | `PATCH /api/bookings/[id]` | ~55 |
| `returnLoanItem(bookingId, itemId, userId)` | `POST /api/bookings/[id]/items/[id]/return` | ~85 |
| `listForUser(userId, role?)` | `GET /api/bookings` | ~35 |

**`create` is the most complex.** Breaks down into:

```typescript
export async function create(user: User, input: BookingCreateInput) {
  // 1. Idempotency check
  const existing = await checkIdempotency(user.id, input.idempotency_key);
  if (existing) return existing;

  // 2. Authorization
  await assertCommunityMember(input.community_id, user.id);

  // 3. Fetch + validate offerings
  const offerings = await fetchAndValidateOfferings(input.items, input.community_id, user.id);

  // 4. Calculate amounts
  const { bookingData, itemsForRpc } = calculateAmounts(user, input, offerings);

  // 5. Call RPC (atomic: booking + items + snapshots + conversation + offer)
  const bookingId = await callCreateBookingRpc(bookingData, itemsForRpc);

  // 6. Fetch and return
  return fetchCreatedBooking(bookingId);
}
```

Each sub-function is a private function in the same file — clear, testable, single-purpose.

### `offer-service.ts`

| Method | Current location | Lines extracted |
|---|---|---|
| `counter(bookingId, userId, amount, note?)` | `POST /api/bookings/[id]/offers` | ~40 |
| `accept(bookingId, userId, offerId)` | Same | ~40 |
| `decline(bookingId, userId, offerId)` | Same | ~35 |
| `listForBooking(bookingId, userId)` | `GET /api/bookings/[id]/offers` | ~15 |

### `offering-service.ts`

| Method | Lines |
|---|---|
| `getDetail(offeringId)` | ~15 |
| `update(offeringId, userId, input)` | ~40 |
| `softDelete(offeringId, userId)` | ~30 |
| `createSchedule(offeringId, userId, input)` | ~60 |
| `updateSchedule(offeringId, scheduleId, userId, input)` | ~65 |
| `deleteSchedule(offeringId, scheduleId, userId)` | ~25 |
| `getTimeSlots(offeringId, scheduleId, date)` | ~70 |

### `community-service.ts`

| Method | Lines |
|---|---|
| `create(userId, input)` | ~30 |
| `update(communityId, userId, input)` | ~40 |
| `softDelete(communityId, userId)` | ~25 |
| `join(communityId, userId)` | ~90 |
| `leave(communityId, userId)` | ~40 |
| `updateMember(communityId, memberId, userId, input)` | ~65 |
| `removeMember(communityId, memberId, userId)` | ~55 |
| `createInvitation(communityId, userId, input)` | ~110 |
| `respondToInvitation(invitationId, userId, action)` | ~130 |
| `generateInviteLink(communityId, userId)` | ~45 |
| `revokeInviteLink(communityId, userId)` | ~35 |

### `address-service.ts`

| Method | Lines |
|---|---|
| `list(userId)` | ~35 |
| `create(userId, input)` | ~140 (includes geocoding) |
| `update(addressId, userId, input)` | ~160 (includes conditional geocoding) |
| `softDelete(addressId, userId)` | ~30 |

Private helpers: `geocodeAddress(input)`, `mergeGeocodeResult(input, nominatim)`, `handleDefaultSetting(userId, addressId)`.

### `conversation-service.ts`

| Method | Lines |
|---|---|
| `listForUser(userId, type?)` | ~85 |
| `createDirect(userId, otherProfileId)` | ~95 |
| `getMessages(conversationId, userId, cursor?)` | ~85 |
| `sendMessage(conversationId, userId, content)` | ~70 |

### `profile-service.ts`

| Method | Lines |
|---|---|
| `update(profileId, userId, input)` | ~65 |
| `uploadAvatar(profileId, userId, file)` | ~270 (storage retry logic) |
| `deleteAvatar(profileId, userId)` | ~120 (storage cleanup) |

### `notification-service.ts`

| Method | Lines |
|---|---|
| `list(userId, filters?, cursor?)` | ~60 |
| `markRead(notificationId, userId)` | ~25 |
| `markAllRead(userId)` | ~20 |
| `delete(notificationId, userId)` | ~25 |
| `getUnreadCount(userId)` | ~20 |

### `board-service.ts`

| Method | Lines |
|---|---|
| `getFeed(communityId, userId, cursor?)` | ~170 |
| `pin(communityId, userId, itemType, itemId)` | ~70 |
| `unpin(communityId, userId)` | ~35 |

---

## Utilities to Extract

### `parse-request.ts`

```typescript
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(parseZodError(result.error));
  }
  return result.data;
}
```

Replaces 12+ identical try/catch + safeParse blocks.

### `date-helpers.ts`

```typescript
export function dateFromYMD(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function timeFromHHMM(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

export function formatTime(value: unknown): string {
  // Handles Prisma Time → "HH:MM" conversion
}
```

Replaces repeated date/time construction in schedule routes.

### `rpc-errors.ts`

```typescript
export function mapRpcError(error: unknown): DomainError {
  const msg = (error as Error)?.message ?? '';
  if (msg.includes('Not enough slots')) return new InsufficientSlotsError();
  if (msg.includes('version mismatch')) return new VersionMismatchError();
  if (msg.includes('cancelled')) return new ConflictError('Schedule is cancelled for this date');
  if (msg.includes('already been returned')) return new ConflictError('Item has already been returned');
  if (msg.includes('Cannot book your own')) return new ForbiddenError('You cannot book your own offering');
  // Unknown RPC error
  console.error('[RPC error]', msg);
  throw error;
}
```

Replaces ad-hoc string matching in booking routes.

---

## Route Handler After Refactor

Before (booking creation — 330 lines):
```typescript
export const POST = withSecureAuth(async (user, request) => {
  // 330 lines of interleaved HTTP + business logic
});
```

After (~15 lines):
```typescript
export const POST = withSecureAuth(async (user, request) => {
  const input = await parseJsonBody(request, bookingCreateSchema);

  try {
    const result = await bookingService.create(user, input);
    return successResponse({ booking: result }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});
```

---

## Implementation Order

| Phase | What | Impact |
|---|---|---|
| **1** | `domain-errors.ts` + `handle-service-error.ts` + `parse-request.ts` | Foundation — all services depend on these |
| **2** | Guards: `assert-community-member`, `assert-offering-owner`, `assert-booking-party` | Eliminates the most duplicated code |
| **3** | `booking-service.ts` | Highest complexity route, biggest win |
| **4** | `offer-service.ts` | Tightly coupled with booking |
| **5** | `community-service.ts` | Second most routes (13) |
| **6** | `offering-service.ts` + `date-helpers.ts` | Schedule-related logic |
| **7** | `address-service.ts` | Geocoding extraction |
| **8** | `conversation-service.ts`, `notification-service.ts`, `board-service.ts` | Lower complexity |
| **9** | `profile-service.ts` | Avatar storage retry logic |
| **10** | `rpc-errors.ts` + clean up remaining Supabase calls | Final consistency pass |

Each phase: extract service → update route handler → run e2e tests → next.

---

## What NOT to Extract

- **Simple CRUD GETs** with no business logic (offering detail, post detail, notification list) — the route handler can call Prisma directly. Don't create a service function that just wraps `prisma.X.findUnique()`.
- **Pagination** — already extracted into `buildPaginatedResponse()`. No service needed.
- **Response formatting** — stays in route handlers. Services return domain objects, not HTTP responses.
