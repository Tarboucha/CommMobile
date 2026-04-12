# Loan/Borrow Model Plan

## Current State

All offerings follow a purchase model (money exchanged for goods/services). The system supports:
- **Categories:** product, service, share, event
- **Pricing:** fixed, negotiable, free, donation
- **Schedules:** recurring/one-time availability with slot-based capacity
- **Bookings:** single-date slot reservation, slots never released on cancellation

Communities often need to share resources temporarily — tools, equipment, books, spaces — without a permanent transfer.

---

## Proposed Approach

**New Transaction Type: `loan`**

This is not a new offering category — any offering can be loaned. It's a new **transaction model** alongside the existing purchase flow.

### Design Principles

The loan system integrates into the existing schedule system rather than being bolted on separately. Key insight: **the schedule defines the loan terms** (duration, capacity), not the offering itself. This allows the same offering to have different loan terms on different days.

---

## Schema Changes

### Offerings table
```sql
CREATE TYPE offering_transaction_type AS ENUM ('purchase', 'loan');

ALTER TABLE offerings ADD COLUMN transaction_type offering_transaction_type DEFAULT 'purchase';
ALTER TABLE offerings ADD COLUMN requires_deposit BOOLEAN DEFAULT FALSE;
ALTER TABLE offerings ADD COLUMN deposit_amount DECIMAL(10,2);  -- Refundable deposit
```

### Availability schedules table
```sql
-- Loan duration is on the SCHEDULE, not the offering
-- Different schedules can have different loan terms
ALTER TABLE availability_schedules ADD COLUMN loan_duration_days INT DEFAULT 1;
ALTER TABLE availability_schedules ADD COLUMN loan_max_duration_days INT;
```

### Schedule exceptions table
```sql
-- Exceptions can override loan terms for specific dates
ALTER TABLE schedule_exceptions ADD COLUMN override_loan_duration_days INT;
ALTER TABLE schedule_exceptions ADD COLUMN override_loan_max_duration_days INT;
```

### Booking items table
```sql
ALTER TABLE booking_items ADD COLUMN is_loan BOOLEAN DEFAULT FALSE;
ALTER TABLE booking_items ADD COLUMN loan_start_date DATE;
ALTER TABLE booking_items ADD COLUMN loan_due_date DATE;
ALTER TABLE booking_items ADD COLUMN loan_returned_at TIMESTAMPTZ;
ALTER TABLE booking_items ADD COLUMN deposit_amount DECIMAL(10,2);
```

### New booking statuses
Extend the existing status enum:
- `pending` → `confirmed` → `loaned_out` → `returned` → `completed`
- `overdue` (triggered when `loan_due_date` has passed without return)

---

## Multi-Day Slot Reservation (Critical Design Change)

Current system: one booking = one `schedule_instance` entry for one date.
Loan system: one loan = `schedule_instance` entries for EVERY day of the loan period.

### Booking RPC changes for loans
```
For a 7-day loan starting Monday:
  1. Check slots_available for ALL 7 days (Mon-Sun)
  2. If ANY day is fully booked → reject with "not available for this period"
  3. Check schedule_exceptions for ALL 7 days → if any day is cancelled → reject
  4. Compute effective_slots per day (considering exceptions with override_slots)
  5. Reserve slots on ALL 7 days (upsert schedule_instances for each)
```

This is the biggest change to the booking RPC. The current single-date reservation loop becomes a date-range loop for loan items.

---

## Return Flow — Slot Release (Critical Design Change)

Current system: cancelled bookings NEVER release slots.
Loan system: returned items MUST release slots.

### New RPC: `return_loan_item(p_booking_item_id UUID)`
```
1. Validate the booking item is a loan and status is 'loaned_out'
2. FOR each day from loan_start_date to loan_due_date:
   - Decrement schedule_instances.slots_booked for that day
3. Set booking_items.loan_returned_at = NOW()
4. If all items in booking are returned → set booking status to 'returned'
```

### New API endpoint
`POST /api/bookings/[bookingId]/items/[itemId]/return`

---

## Availability Check for Loans

To determine if an offering is available for a loan starting on date X for N days:
```
FOR each day from X to X+N:
  effective_slots = COALESCE(exception.override_slots, schedule.slots_available)
  current_booked = COALESCE(schedule_instances.slots_booked, 0)
  IF current_booked >= effective_slots → NOT AVAILABLE
  IF exception.is_cancelled → NOT AVAILABLE

IF all days pass → AVAILABLE
```

This check must happen at booking time (in the RPC with FOR UPDATE locks) and can also be used for the frontend availability calendar.

---

## Exception Handling for Loans

- A `schedule_exception` with `is_cancelled = true` on a Wednesday prevents:
  - New loans from **starting** on Wednesday
  - New loans from **spanning** Wednesday (e.g., Monday-Friday loan blocked)
- It does NOT affect existing loans that already span that Wednesday (those slots are already reserved)
- Exception `override_loan_duration_days` allows date-specific loan term changes (e.g., holiday period = max 1 day loan)

---

## Offering Creation Changes

- New toggle in creation form: "Available for borrowing" (sets `transaction_type: 'loan'`)
- When enabled:
  - Schedule creation includes loan duration fields (default + max)
  - Optional deposit amount field on the offering
  - Price becomes optional (loans can be free or have a rental fee)
  - Fulfillment method still applies (pickup the item, deliver it, etc.)

---

## Booking Flow Changes

- When adding a loan offering to cart:
  - Show date range picker for loan period
  - Duration constrained by schedule's `loan_duration_days` / `loan_max_duration_days`
  - Show deposit amount if required
  - Total = rental fee (if any) + deposit
  - Availability checked across entire date range before allowing add-to-cart
- Booking confirmation shows due date

---

## Return Flow

- Provider can mark individual items as "Returned" via the booking detail screen
- If not returned by due date:
  - Cron job or trigger sets status to `overdue`
  - Notification sent to borrower
  - Provider can extend the due date or escalate
- Deposit release: manual (provider confirms return and condition)

### Overdue Detection
- Option A: DB cron job (pg_cron) that checks `loan_due_date < NOW()` for active loans daily
- Option B: Check on booking detail screen load and update status if overdue
- Option A is more reliable but requires pg_cron setup

---

## UI Indicators

- Board: loan offerings show a "Borrow" badge instead of price
- Offering detail: shows loan terms (duration, deposit, return policy)
- My Bookings: loan bookings show due date, return status, return button
- Calendar: loan periods shown as blocked ranges

---

## Files Summary

### Files to Create
- DB migration for new columns and statuses
- New RPC: `return_loan_item(p_booking_item_id UUID)`
- `POST /api/bookings/[bookingId]/items/[itemId]/return` — return endpoint

### Files to Modify
- `docs/newdb/schema.sql` — new columns on offerings, availability_schedules, schedule_exceptions, booking_items
- `docs/newdb/migrations/003_create_booking_rpc.sql` — multi-day slot reservation for loans
- `nextserver/src/lib/validations/offering.ts` — loan fields validation
- `nextserver/src/lib/validations/booking.ts` — loan booking validation
- `nextserver/src/app/api/bookings/route.ts` — handle loan bookings with date-range reservation
- `nextserver/src/app/api/bookings/[bookingId]/route.ts` — handle loan statuses
- `nativeCom/src/types/offering.ts` — add transaction_type, loan fields, schedule loan fields
- `nativeCom/src/types/booking.ts` — add loan fields
- `nativeCom/src/app/community/[communityId]/offerings/new.tsx` — loan toggle + schedule loan fields
- `nativeCom/src/app/booking/index.tsx` — loan date range picker, deposit display
- `nativeCom/src/app/booking/[bookingId]/index.tsx` — return button, due date display, overdue indicator
- `nativeCom/src/components/pages/community/board-tab.tsx` — loan badge in offering cards

---

## Open Questions

1. Should loans track item condition (returned in good/damaged condition)?
2. Should overdue items trigger automatic penalties?
3. Should the deposit be handled in-app (requires payment integration) or tracked externally like current payments (cash/external)?
4. Should the loan duration be selectable by the borrower (within min/max range) or fixed by the provider?
5. Can a provider extend an active loan's due date if the borrower requests it?
6. Should there be a waitlist for items currently on loan?
