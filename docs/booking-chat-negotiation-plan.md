# Booking Chat & Price Negotiation Plan

## Context

After a booking is created, KoDo needs a chat between customer and provider for logistics, questions, and price negotiation. Currently, a booking conversation is lazily created when the user opens the chat screen, but there are no structured message types (offers, status updates) — only free text.

This plan upgrades the booking chat into a modern negotiation-aware flow, inspired by Vinted (offer cards in chat), Fiverr (custom offers), and Airbnb (special offers).

---

## Core Design Decision: Negotiation Is Universal

**`price_type` is deprecated** — negotiation availability is derived from `price_amount`:

- `price_amount > 0` → "Book" + "Make an Offer" buttons shown. Negotiation always available (Vinted-style).
- `price_amount = 0 / NULL` → free offering. No offer button. Direct booking only.

Every priced offering accepts offers. No special flag needed.

---

## Design Principles

1. **Chat created atomically with booking** — conversation is created inside the `create_booking_with_items` RPC, not lazily. Both parties see it immediately.
2. **Structured message types** — offers, status transitions, and booking cards are first-class message types rendered as rich widgets, not plain text.
3. **Two booking flows, same status** depending on customer choice:
   - **Book at listed price** → booking status `pending`, `accepted_offer_id = NULL`. Chat opens with a booking request card. Provider confirms or refuses.
   - **Make an Offer** → booking status `pending`, `accepted_offer_id = NULL`, a `price_offers` row with `status = 'pending'` exists. Chat opens with a booking request card + customer's offer card. Provider can Accept, Counter, or Decline from the chat. Provider should not Accept/Refuse the booking itself until the offer is resolved.
4. **In-chat actions** — Accept, Counter, Decline are buttons on offer cards inside the chat.
5. **System messages** — automated messages for every status transition keep the chat as the single timeline of the booking lifecycle.

---

## Reference: How Vinted Does It

- **"Buy Now" + "Make an Offer" on every listing** — negotiation not gated by a flag.
- **Offers are structured cards inside the chat** — item thumbnail, offered price, original price, Accept/Decline/Counter buttons. Free-text messages coexist alongside.
- **Offer cards are stateful** — countered cards grey out, accepted cards update with checkout CTA.
- **24-hour expiry** on pending offers. Counter resets the timer.
- **Symmetric** — both buyer and seller can counter. No round limit (1-2 typical).
- **Acceptance → checkout** — redirects to checkout pre-filled with agreed price.
- **System messages** mark every transition: "X made an offer of Y", "Offer expired", "Offer accepted."

### KoDo adaptations from Vinted

| Vinted pattern | KoDo adaptation |
|---|---|
| Offer cards in chat | `price_offer` message type with Accept/Counter/Decline buttons |
| In-place card state updates | Offer card renders based on `offer_status` in metadata |
| 24h expiry | Same — background job or lazy check |
| Counter resets timer | Same |
| Both parties can counter | Same — symmetric |
| Acceptance → checkout | Acceptance updates `bookings.total_amount`, sets `accepted_offer_id` |
| System messages | `status_update` message type |

### Where KoDo differs

- **Multiple transaction types** — products, services (time-slotted), events, loans. Vinted is products only.
- **Post-acceptance flow varies** — pickup/delivery, service appointment, loan period. Vinted is ship → deliver → confirm.
- **Cart for products, direct booking for services/loans** — Vinted has no cart equivalent.

---

## Message Types

Extend the `messages` table with a `message_type` enum and a `metadata` JSONB column:

| message_type | Sender | Render as | metadata |
|---|---|---|---|
| `text` | Either | Chat bubble (current) | `null` |
| `booking_request` | System | Booking summary card: items, total, dates | `{ booking_id, items_summary, total_amount }` |
| `price_offer` | Either | Offer card: proposed amount + Accept/Counter/Decline buttons | `{ offer_id, offered_amount, currency, note? }` |
| `offer_response` | System | Status pill: "Offer accepted" / "Offer declined" / "Offer expired" | `{ offer_id, action, agreed_amount? }` |
| `status_update` | System | Centered muted pill: "Booking confirmed" / "Loaned out" | `{ from_status, to_status, changed_by }` |

### Offer lifecycle

```
Customer books at listed price (50 EUR):
  → booking(pending) + conversation + booking_request msg
  → No price_offers rows. accepted_offer_id = NULL.
  → Provider sees booking card → confirms via PATCH → status_update msg
  → Normal flow

Customer makes an offer (40 EUR):
  → booking(pending) + conversation + booking_request msg + price_offer msg
  → price_offers row created (status = 'pending'). accepted_offer_id = NULL.
  → Provider sees offer card with 3 options:
    A) Accept → offer_response(accepted) msg → booking.total_amount = 40,
       accepted_offer_id set → provider can now Accept/Refuse the booking itself
    B) Counter (45 EUR) → new price_offer msg, previous offer → superseded
       → Customer sees new offer card → Accept/Counter/Decline
    C) Decline → offer_response(declined) msg → booking status → cancelled

On accept: booking amounts updated atomically, normal confirm/refuse flow begins.
```

### How the provider knows there's a pending offer

No new booking status needed. The UI checks:
- `accepted_offer_id IS NULL` AND `price_offers WHERE booking_id = X AND offer_status = 'pending'` exists → negotiation in progress, show offer card in chat, hide Accept/Refuse on booking detail until offer is resolved.
- `accepted_offer_id IS NULL` AND no pending offers → booked at listed price, normal Accept/Refuse flow.
- `accepted_offer_id IS NOT NULL` → offer was accepted, price agreed, normal flow.

---

## Database Changes

### New enum: `message_type`

```sql
CREATE TYPE public.message_type AS ENUM (
  'text',
  'booking_request',
  'price_offer',
  'offer_response',
  'status_update'
);
```

### Alter `messages` table

```sql
ALTER TABLE public.messages
  ADD COLUMN message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN metadata JSONB;
```

### Alter `bookings` table

```sql
ALTER TABLE public.bookings ADD COLUMN accepted_offer_id UUID REFERENCES price_offers(id);
```

NULL = booked at listed price. Set = points to the accepted offer (O(1) join for agreed amount + offer details).

### New table: `price_offers`

```sql
CREATE TABLE public.price_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  message_id      UUID NOT NULL REFERENCES messages(id),
  offered_by      UUID NOT NULL REFERENCES profiles(id),
  offered_amount  NUMERIC(10,2) NOT NULL,
  currency_code   TEXT NOT NULL DEFAULT 'EUR',
  note            TEXT,
  offer_status    TEXT NOT NULL DEFAULT 'pending'
    CHECK (offer_status IN ('pending', 'accepted', 'declined', 'expired', 'superseded')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_offers_booking ON price_offers(booking_id);
CREATE INDEX idx_price_offers_pending ON price_offers(booking_id)
  WHERE offer_status = 'pending';
```

**Rules:**
- Only one `pending` offer per booking at a time.
- New counter auto-supersedes the previous pending offer.
- On accept: `bookings.total_amount` + `bookings.subtotal_amount` updated, `bookings.accepted_offer_id` set. Booking stays `pending` — provider can now Accept/Refuse normally.
- On decline (by provider): status → `cancelled`.
- On decline (by customer, of a counter-offer): offer marked `declined`, customer can counter again or cancel the booking.
- Expired: background check or lazy check on fetch. System `offer_response(expired)` message inserted.

### Agreed price storage

No new "agreed_amount" column needed. The existing model covers it:

- `bookings.total_amount` → always reflects what the customer pays (updated on offer acceptance)
- `booking_items.unit_price_amount` → snapshot of the original listed price at booking time
- `bookings.accepted_offer_id` → FK to the winning `price_offers` row (NULL = booked at listed price, no negotiation)

This gives O(1) lookup for the agreed price: `LEFT JOIN price_offers ON bookings.accepted_offer_id = price_offers.id`. The full negotiation history remains queryable via `price_offers WHERE booking_id = X ORDER BY created_at`.

### Automatic conversation creation

Extend `create_booking_with_items` RPC with a new Phase 5:

1. Create conversation: `conversation_type = 'booking'`, `booking_id = new_booking_id`
2. Add customer + provider as participants
3. Insert `booking_request` system message with booking summary metadata
4. If customer made an offer (offer data in `p_booking` JSONB): insert `price_offer` message + `price_offers` row

This removes the lazy `create_booking_conversation` RPC pattern.

### Status update trigger

Create a trigger on `bookings` that fires on `booking_status` changes. For each transition, it:
1. Finds the conversation linked to the booking
2. Inserts a `status_update` message with `{ from_status, to_status, changed_by }`
3. Updates `conversations.last_message_at` + `last_message_preview`

This ensures every status change appears in the chat timeline automatically.

---

## Backend API Changes

### `POST /api/bookings` response
Add `conversation_id` to the response so the frontend can navigate directly to chat.

### New: `POST /api/bookings/:bookingId/offers`

```json
// Counter-offer
{ "action": "counter", "offered_amount": 45, "note": "Meet in the middle?" }

// Accept a pending offer
{ "action": "accept", "offer_id": "uuid" }

// Decline a pending offer
{ "action": "decline", "offer_id": "uuid" }
```

Server logic:
1. Validate user is a party to the booking
2. Validate booking is `pending` (not yet confirmed/completed/cancelled)
3. For `counter`: supersede previous pending offer, create new `price_offers` row + `price_offer` message
4. For `accept`: update offer status, update `bookings.total_amount`, set `accepted_offer_id`, insert `offer_response` message
5. For `decline`: update offer status, insert `offer_response` message. If provider declines → cancel booking. If customer declines a counter → offer marked declined, negotiation can continue.
6. Broadcast `message:new` via socket

### Modify booking status PATCH route

After updating status, insert a `status_update` message into the booking's conversation. (Or use the trigger approach above — trigger is cleaner since it catches all status changes regardless of source.)

---

## Frontend Changes

### Offering detail: dual action buttons

For priced offerings (`price_amount > 0`):
```
┌─────────────────────────────────────────┐
│  [  Book — 50.00 EUR  ] [ Make an Offer ]│
└─────────────────────────────────────────┘
```

"Book" → existing flow (direct booking at listed price → `pending`).
"Make an Offer" → opens a sheet with price input + optional note → creates booking at offered price → `pending` with a pending offer.

For free offerings: only "Book" button (no offer).

### Chat message rendering

Create message-type-specific components:

**`BookingRequestCard`** — full-width card:
- Offering thumbnail + title
- Items summary (quantity, fulfillment method)
- Total amount
- Date/time slot (if applicable)
- Loan period (if applicable)

**`PriceOfferCard`** — card with:
- Sender avatar + name
- "Offered X EUR" with original price struck through
- Optional note
- If `offer_status = 'pending'` AND viewer is the recipient: Accept / Counter / Decline buttons
- If `superseded`: greyed out with "Superseded" label
- If `accepted`: green "Accepted" badge
- If `declined` / `expired`: muted "Declined" / "Expired" badge

**`OfferResponsePill`** — centered system message:
- "Offer of X EUR accepted" (green)
- "Offer declined" (red)
- "Offer expired" (muted)

**`StatusUpdatePill`** — centered system message:
- "Booking confirmed" / "Marked as loaned out" / "Returned" / etc.
- Icon + muted color matching the status

### Chat screen updates

- **Pinned booking header** at the top (not scrollable): offering title, current price/status, quick link to booking detail
- **Smart input bar**: when there's a pending offer, show a "Make an Offer" chip above the text input that opens the counter-offer sheet
- **Disabled input when resolved**: if booking is `cancelled` or `completed`, the text input shows "This booking is closed"

### Booking detail screen updates

When there's a pending offer (`accepted_offer_id IS NULL` + pending `price_offers` exist):
- Status header shows "Negotiating" badge alongside "Pending"
- Action bar: "Open Chat" button instead of Accept/Refuse (negotiation happens in chat)
- Show current offer amount + who proposed it

When no pending offer (either no negotiation, or offer accepted):
- Normal Accept/Refuse flow for provider
- If `accepted_offer_id` is set, show "Agreed: X EUR" (may differ from original listing price)

---

## Flow Diagrams

### Book at listed price
```
Customer taps "Book" → POST /api/bookings (listed price)
  → booking(pending) + conversation + booking_request msg
  → Provider sees booking card in chat
  → Provider taps Accept (PATCH) → status_update msg in chat
  → in_progress → ready → completed (each with status_update msg)
```

### Make an Offer
```
Customer taps "Make an Offer" → enters 40 EUR
  → POST /api/bookings (listed price in items, offer amount in payload)
  → booking(pending) + conversation + booking_request msg + price_offer msg (40 EUR)
  → accepted_offer_id = NULL, price_offers has 1 row (status: pending)

Provider opens chat, sees offer card:
  Option A: Accept → POST /api/bookings/:id/offers { accept }
    → offer_response(accepted) msg → booking.total = 40, accepted_offer_id set
    → Provider can now Accept/Refuse the booking normally

  Option B: Counter 45 EUR → POST /api/bookings/:id/offers { counter, 45 }
    → Previous offer → superseded, new price_offer msg (45 EUR)
    → Customer sees new offer card → Accept/Counter/Decline

  Option C: Decline → POST /api/bookings/:id/offers { decline }
    → offer_response(declined) msg → booking status → cancelled
```

### Loan with negotiation
```
Customer offers 0 EUR for a loan (listed deposit: 50 EUR)
  → booking(pending) + conversation + booking_request + price_offer(0 EUR)
  → Provider counters: "I need at least the deposit" (offer: 50 EUR)
  → Customer accepts → booking.total = 50, accepted_offer_id set
  → Provider accepts booking → confirmed → loaned_out → returned
```

---

## Edge Cases

1. **Only one pending offer per booking** — new counter auto-supersedes the previous.
2. **24h expiry** — lazy check on fetch + optional background job. System `offer_response(expired)` message inserted.
3. **Booking cancelled during negotiation** — all pending offers → `expired`. Conversation stays readable. Either party can cancel a `pending` booking at any time.
4. **Price floor** — soft warning at 50% of listed price. No hard block.
5. **Provider modifies offering during negotiation** — booking uses snapshots, so negotiation is against the snapshot price. No confusion.
6. **Conversation already exists** — RPC checks before creating (idempotent).
7. **Socket disconnect during negotiation** — offer persists in DB. On reconnect, messages fetched via query.
8. **Customer cancels before provider responds** — booking cancelled, pending offer → `expired`.
9. **Multiple items in booking** — offer applies to the booking total, not per-item. Individual item prices aren't negotiated separately.

---

## Implementation Phases

| Phase | What | Scope |
|---|---|---|
| **A** | DB migration: `message_type` + `metadata` on messages, `price_offers` table, `accepted_offer_id` on bookings | Schema foundation |
| **B** | Move conversation creation into booking RPC + insert `booking_request` system message | Atomic chat creation |
| **C** | Status update trigger/hook: insert `status_update` messages on booking transitions | Chat as timeline |
| **D** | `POST /api/bookings/:bookingId/offers` endpoint + offer lifecycle logic | Core negotiation API |
| **E** | Frontend: message type components (BookingRequestCard, PriceOfferCard, StatusUpdatePill) | Rich chat rendering |
| **F** | Frontend: "Make an Offer" flow on offering detail + offer sheet | Customer-facing offer UX |
| **G** | Frontend: chat pinned header + smart input bar + offer action buttons | Chat UX polish |
| **H** | Offer expiry (background or lazy) + notifications | Reliability |

### Critical path: A → B → C → D → E → F

C and D can be parallelized. G and H are polish.

---

## Files to Create/Modify

### New files
- `nextserver/prisma/migrations/<ts>_add_chat_negotiation/migration.sql`
- `nextserver/src/app/api/bookings/[bookingId]/offers/route.ts`
- `nativeCom/src/components/chat/booking-request-card.tsx`
- `nativeCom/src/components/chat/price-offer-card.tsx`
- `nativeCom/src/components/chat/status-update-pill.tsx`
- `nativeCom/src/components/booking/make-offer-sheet.tsx`

### Modified files
- `nextserver/prisma/schema.prisma` — new models + enum
- `nextserver/prisma/migrations/.../migration.sql` — RPC update for conversation creation
- `nextserver/src/app/api/bookings/route.ts` — return `conversation_id`
- `nextserver/src/app/api/bookings/[bookingId]/route.ts` — status change inserts system message
- `nativeCom/src/app/booking/[bookingId]/chat.tsx` — render by message_type
- `nativeCom/src/app/booking/[bookingId]/index.tsx` — negotiation state in action bar
- `nativeCom/src/app/community/[communityId]/offerings/[offeringId]/index.tsx` — dual Book/Offer buttons
- `nativeCom/src/types/booking.ts` — new types
- `nativeCom/src/hooks/queries/use-booking-mutations.ts` — offer mutation

---

## Open Questions

1. **Offer expiry: 24h (Vinted) or longer?**
   - Suggestion: 24h for community context. Configurable per-community later.

2. **Price floor: hard or soft?**
   - Suggestion: soft warning at 50%. No hard block.

3. **Offers on free offerings?**
   - Suggestion: no. Free = free.

4. **Deposit negotiation for loans?**
   - Suggestion: Phase 2. For now, deposit is fixed by the offering. Negotiation applies to the service/product price only.
