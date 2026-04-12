# Offerings DB Migration Plan

## Prerequisites

1. **Prisma ORM integration in nextserver** — must be set up first so migrations are managed via `prisma migrate`
2. **Introspect existing DB** — `prisma db pull` to generate initial schema from current Supabase tables

---

## Migration Steps (in order)

### Step 1: Add new enums

```
- Add transaction_type enum: 'purchase', 'booking', 'loan', 'free'
- Add new booking_status values: 'loaned_out', 'returned', 'overdue'
```

No data changes. Purely additive.

### Step 2: Add new columns to offerings

```
offerings:
  + transaction_type (default: 'purchase', not null)
  + requires_deposit (default: false)
  + deposit_amount (decimal, nullable)
  + venue_name (text, nullable) — for events
  + venue_address_id (FK → addresses, nullable) — for events
  + is_online (boolean, default: false) — for services
  + service_location_address_id (FK → addresses, nullable) — for services
```

**Data migration:** All existing offerings get `transaction_type: 'purchase'` (the default). No data loss.

### Step 3: Add loan fields to availability_schedules

```
availability_schedules:
  + loan_duration_days (int, default: 1)
  + loan_max_duration_days (int, nullable)
```

No data migration needed — existing schedules are for purchases, loan fields stay null/default.

### Step 4: Add loan overrides to schedule_exceptions

```
schedule_exceptions:
  + override_loan_duration_days (int, nullable)
  + override_loan_max_duration_days (int, nullable)
```

No data migration needed.

### Step 5: Add loan tracking to booking_items

```
booking_items:
  + is_loan (boolean, default: false)
  + loan_start_date (date, nullable)
  + loan_due_date (date, nullable)
  + loan_returned_at (timestamptz, nullable)
  + deposit_amount (decimal, nullable)
  + snapshot_transaction_type (text, nullable)
```

**Data migration:** All existing booking items get `is_loan: false` (the default).

### Step 6: Add deposit tracking to bookings

```
bookings:
  + deposit_total (decimal, default: 0)
  + deposit_status (varchar, default: 'none') — 'none' | 'held' | 'released' | 'forfeited'
  + provider_id (uuid, nullable, FK → profiles) — denormalized for quick queries (if not already present)
```

**Data migration:** All existing bookings get `deposit_total: 0`, `deposit_status: 'none'`.

### Step 7: Add loan snapshots to booking_schedule_snapshots

```
booking_schedule_snapshots:
  + snapshot_loan_duration_days (int, nullable)
  + snapshot_loan_max_duration_days (int, nullable)
  + exception_override_loan_duration_days (int, nullable)
```

No data migration needed — existing snapshots are for purchases.

### Step 8: Handle offering_category enum cleanup

```
- Remove 'share' from offering_category (or deprecate)
- Remove 'food' from offering_category (or keep if needed)
```

**Data migration required:**
- Any offerings with `category: 'share'` → migrate to `category: 'product'` with `transaction_type: 'loan'` (or 'free')
- Any offerings with `category: 'food'` → migrate to `category: 'product'`
- Verify no rows reference old values before dropping enum values

**Note:** PostgreSQL doesn't support removing enum values directly. Options:
- Create new enum, migrate column, drop old enum
- Or keep old values but stop using them in the app (simpler, less risky)

### Step 9: Create loan return RPC

```sql
CREATE FUNCTION return_loan_item(p_booking_item_id UUID)
  — Validates item is a loan with status 'loaned_out'
  — Decrements slots_booked for each day of loan period
  — Sets loan_returned_at = NOW()
  — Updates booking status to 'returned' if all items returned
```

### Step 10: Update booking creation RPC

Modify `create_booking_with_items` to handle loan items:
- Multi-day slot reservation (loop through loan_start_date to loan_due_date)
- Availability check across entire date range
- FOR UPDATE locks on all days
- Store loan fields on booking_items

---

## Rollback Strategy

Each step is additive (new columns, new enum values). No destructive changes until Step 8 (enum cleanup). If something goes wrong:
- Steps 1-7: Drop the new columns/enums (no data loss)
- Step 8: Only run after verifying all data migrated
- Steps 9-10: Drop/replace the functions

---

## RLS Updates Needed

- Offerings policies: no changes needed (new columns don't affect access)
- Booking policies: may need updates for loan-specific statuses ('loaned_out', 'returned', 'overdue')
- New policy: who can call `return_loan_item`? → provider of the booking only

---

## Indexes to Add

```
offerings: (community_id, transaction_type)
booking_items: (is_loan, loan_due_date) WHERE is_loan = true — for overdue detection queries
```

---

## Order of Implementation

1. Set up Prisma in nextserver
2. Introspect existing DB (`prisma db pull`)
3. Run Steps 1-7 as a single Prisma migration (all additive, safe)
4. Update API routes to read/write new fields
5. Update frontend types and screens
6. Step 8 (enum cleanup) — only after app is fully migrated
7. Steps 9-10 (loan RPCs) — when implementing the loan booking flow
8. Update RLS policies
9. Add indexes

---

## Open Questions

1. Should we keep `share` and `food` enum values as deprecated (never shown in UI) or fully remove them?
2. Should `provider_id` on bookings be backfilled from existing booking_items for query performance?
3. Should the loan return RPC be a Prisma-managed function or a raw SQL migration alongside Prisma?
