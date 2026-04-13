# Booking UX Per Category Plan

## Problem

The booking detail screen and booking list treat everything like a product purchase. A haircut appointment, a community workshop, and a drill loan all show the same timeline (`pending → confirmed → in_progress → ready → completed`), the same payment summary, and the same action buttons. The UX doesn't reflect what the customer actually booked.

---

## Current State

| Aspect | Product | Loan | Service | Event |
|---|---|---|---|---|
| **Creation flow** | Cart → checkout | Borrow sheet (date) | Book sheet (date + time) | RSVP sheet (date) |
| **Detail screen** | Generic | Loan-aware (dates, deposit, return) | Generic (same as product) | Generic (same as product) |
| **Timeline** | pending→confirmed→in_progress→ready→completed | pending→confirmed→loaned_out→returned | Same as product | Same as product |
| **Item card** | Qty + delivery fee | Loan period + deposit + return status | Fulfillment badge + date + time slot | Same as service |
| **List screen** | No category indicator | No indicator | No indicator | No indicator |

Loans are the only category with a differentiated detail experience. Services and events are identical to products.

---

## What Should Differ

### Service Appointments

A service booking (haircut, massage, consultation) should feel like an **appointment**, not an order:

**Detail screen changes:**
- **Header**: Show appointment date/time prominently (not buried in item card)
  - "Haircut — Mon, Apr 14 at 10:00–10:45" instead of just "Booking #1234"
- **Timeline**: `pending → confirmed → completed` (skip `in_progress` and `ready` — the service either happens or it doesn't)
- **Provider info section**: Show provider + location for `at_location`/`pickup` fulfillment
- **Action buttons (provider)**:
  - `pending`: Accept / Refuse (same as now)
  - `confirmed`: "Mark Complete" directly (skip Start → Ready)
  - Or: "Start Appointment" → "Complete" (2-step, not 4-step)
- **Action buttons (customer)**:
  - `pending` or `confirmed`: "Cancel" + "Reschedule" (new)
- **No quantity display** (always 1)
- **Deposit section**: hidden (services don't have deposits)

**List screen changes:**
- Show appointment date/time as the primary info: "Apr 14, 10:00" not just the booking number
- Category badge: "Service" in green

### Events

An event booking (workshop, meetup, class) should feel like a **ticket/RSVP**, not an order:

**Detail screen changes:**
- **Header**: Event name + date/time prominently
  - "Community Workshop — Sat, Apr 19 at 14:00–16:00"
- **Timeline**: `pending → confirmed → completed` (or just `confirmed → completed` — events are binary: you're going or you're not)
- **Capacity info**: "12/20 spots filled" (from schedule snapshot)
- **Action buttons (provider)**:
  - `confirmed`: "Mark Complete" directly
- **Action buttons (customer)**:
  - `confirmed`: "Cancel RSVP"
- **Price display**: "Free" or "Ticket: X EUR" (not "Subtotal" / "Total" / "Service Fee")
- **No delivery section** (events are always at_location/online)
- **No special instructions** (or relabel as "Dietary needs" / "Notes for organizer")

**List screen changes:**
- Show event date as primary info
- Category badge: "Event" in amber

### Loans

Already differentiated — just needs minor polish:

**Detail screen additions:**
- **Countdown**: "Due back in 3 days" or "Overdue by 2 days" (live, computed from `loan_due_date`)
- **Deposit refund status**: Explicit messaging: "Your 50 EUR deposit will be refunded after return"
- **Category badge on list**: "Loan" in purple

### Products

Already the default — just needs category context:

**List screen changes:**
- Category badge: "Order" in blue
- Show item count: "3 items" if multi-item booking

---

## Implementation Plan

### Phase 1: Booking Detail — Category-Aware Layout

**File:** `nativeCom/src/app/booking/[bookingId]/index.tsx`

Detect the booking category from `booking_items[0].snapshot_category` (all items share a category since bookings are single-provider, and direct bookings are single-item).

```typescript
const bookingCategory = booking.booking_items[0]?.snapshot_category ?? 'product';
const isService = bookingCategory === 'service';
const isEvent = bookingCategory === 'event';
const isLoan = booking.booking_items.some((item) => item.is_loan);
const isProduct = !isService && !isEvent && !isLoan;
```

**1a. Category-specific header**

Replace the generic status header with a context-rich header:

| Category | Header content |
|---|---|
| Service | "{title} — {date} at {start_time}–{end_time}" |
| Event | "{title} — {date}, {start_time}–{end_time}" |
| Loan | "{title} — Pickup {loan_start_date}, Return by {loan_due_date}" |
| Product | "Order #{booking_number}" (current behavior) |

**1b. Category-specific timelines**

No enum changes needed — the statuses already exist. Only the allowed transitions and displayed steps change per category.

```typescript
const SERVICE_STEPS: BookingStatus[] = ['pending', 'confirmed', 'completed'];
const EVENT_STEPS: BookingStatus[] = ['pending', 'confirmed', 'completed'];
const LOAN_STEPS: BookingStatus[] = ['pending', 'confirmed', 'loaned_out', 'returned'];
const PRODUCT_STEPS: BookingStatus[] = ['pending', 'confirmed', 'in_progress', 'ready', 'completed'];
```

`in_progress` and `ready` only make sense for products (provider prepares → customer picks up). Services/events skip them entirely.

**1c. Category-specific action buttons**

Update `ActionBar` to accept the booking category and adjust the button flow:

| Status | Product (provider) | Service (provider) | Event (provider) | Loan (provider) |
|---|---|---|---|---|
| pending | Accept / Refuse | Accept / Refuse | Accept / Refuse | Accept / Refuse |
| confirmed | Start | Complete | Complete | Mark Loaned Out |
| in_progress | Mark Ready | — | — | — |
| ready | Complete | — | — | — |
| loaned_out | — | — | — | (per-item return) |

**1d. Category-specific payment section**

| Category | Label changes |
|---|---|
| Service | "Service fee" instead of "Subtotal" |
| Event | "Ticket price" or "Free" |
| Loan | Show deposit separately with refund messaging |
| Product | "Subtotal" + "Delivery fee" + "Total" (current) |

**1e. Category-specific timestamp section**

| Category | Show |
|---|---|
| Service | "Appointment: {date} {time}" + "Confirmed at" + "Completed at" |
| Event | "Event date: {date} {time}" + "Confirmed at" |
| Loan | "Pickup: {date}" + "Due: {date}" + "Returned: {date}" + countdown |
| Product | "Created" + "Confirmed" + "Ready" + "Completed" (current) |

---

### Phase 2: Booking List — Category Badges + Contextual Info

**File:** `nativeCom/src/app/account/bookings/index.tsx`

**2a. Category badge**

Add a colored badge to each booking card:
- Product → blue "Order"
- Service → green "Appointment"
- Event → amber "Event"
- Loan → purple "Loan"

Derive from `booking_items[0].snapshot_category` + `is_loan` check (need to add `snapshot_category` to the list query).

**2b. Contextual subtitle**

| Category | Subtitle |
|---|---|
| Product | "{n} items" or item title |
| Service | "{date} at {time}" |
| Event | "{date}, {time}" |
| Loan | "Due back {date}" or "Returned" |

Requires adding `instance_date`, `instance_start_time`, `loan_due_date`, `loan_returned_at` to the list query's item select.

---

### Phase 3: Status Transition Updates (Backend)

**File:** `nextserver/src/lib/services/booking-service.ts`

Allow services/events to skip `in_progress` and `ready`:

```typescript
const SERVICE_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],  // skip in_progress + ready
};

const EVENT_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};
```

This requires knowing the booking's category in `updateBookingStatus`. Add a query for the first item's `snapshot_category` or store the category on the booking itself.

**Option A**: Query `booking_items[0].snapshot_category` when processing status update.
**Option B**: Add `booking_category` column to bookings table (denormalized, but faster).

Recommendation: **Option A** — one extra query is fine, avoids schema change.

---

### Phase 4: Reschedule Flow (Service + Event)

For services and events, add a "Reschedule" action that:
1. Cancels the current booking
2. Opens the booking sheet pre-filled with the offering + new date

This is a v2 feature — skip for initial release.

---

### Phase 5: Loan Countdown + Overdue Detection

Add live countdown on loan detail:
- "Due back in 3 days" (green)
- "Due back tomorrow" (amber)
- "Overdue by 2 days" (red)

Computed client-side from `loan_due_date` — no backend change needed.

Optional: background job or lazy check that sets `booking_status = 'overdue'` when `loan_due_date < today` and status is `loaned_out`.

---

## Files to Modify

### Phase 1 (Detail screen)
- `nativeCom/src/app/booking/[bookingId]/index.tsx` — major refactor of layout per category

### Phase 2 (List screen)
- `nativeCom/src/app/account/bookings/index.tsx` — category badges + contextual subtitles
- `nextserver/src/lib/services/booking-service.ts` — expand `listBookings` item select

### Phase 3 (Backend transitions)
- `nextserver/src/lib/services/booking-service.ts` — category-aware status transitions

### Phase 4-5 (Future)
- Reschedule flow
- Loan countdown + overdue detection

---

## Priority

| Phase | What | Impact |
|---|---|---|
| **1** | Category-aware booking detail | Users understand what they booked |
| **2** | Category badges + context on list | Users find bookings faster |
| **3** | Simplified transitions for services/events | Provider UX — fewer unnecessary steps |
| **4** | Reschedule (v2) | Customer convenience |
| **5** | Loan countdown (v2) | Prevents overdue surprises |
