# Booking RPC Refactor Plan

## Current State

The `create_booking_with_items` RPC in [003_create_booking_rpc.sql](newdb/migrations/003_create_booking_rpc.sql) is a **250-line monolithic function** that does everything in one place:

### What it currently does (4 phases)

1. **Phase 1** — For each item: validate offering version, check schedule exists, check for exceptions, compute effective slots, check availability, reserve slots
2. **Phase 2** — Insert the booking row
3. **Phase 3** — Insert all booking items with offering snapshots
4. **Phase 4** — Create schedule snapshots for scheduled items (re-fetching the same data from Phase 1)

### Pain points

1. **Duplicated work** — Phase 1 fetches the schedule and exception to check availability, then Phase 4 refetches the same rows to snapshot them. Two queries per item instead of one.
2. **Tight coupling** — Validation, reservation, and snapshotting are interleaved. Hard to test or reuse any piece independently.
3. **No abstraction for "availability check"** — The availability logic (effective slots = schedule ± exception, compare against booked) is inlined and repeated mentally. You can't check availability from anywhere else in the codebase without reimplementing it.
4. **Hard to extend for loans** — The new loan model needs the same availability check but **across a date range**, not a single date. With the current structure, we'd have to duplicate or parameterize the entire Phase 1 block.
5. **No dry-run mode** — You can't ask "is this booking possible?" without actually creating it. The frontend has no way to pre-validate before the user confirms.
6. **All-or-nothing error messages** — When Phase 1 fails on item #3, the client gets "not enough slots" but doesn't know which item or what's actually available.

---

## Proposed Refactor: Split Into Composable Sub-Functions

Break the monolith into **three layers**: pure helpers, reservation primitives, and the orchestrator.

### Layer 1 — Pure query helpers (read-only)

```sql
-- Returns the effective capacity for a schedule on a specific date,
-- accounting for exceptions (override_slots or cancellation).
-- Returns NULL if the schedule is cancelled for that date.
CREATE FUNCTION get_effective_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT;

-- Returns how many slots are currently booked for a specific date.
-- Returns 0 if no instance row exists yet.
CREATE FUNCTION get_booked_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT;

-- Returns the available slot count (effective - booked).
-- Returns 0 if cancelled, NULL if schedule doesn't exist.
CREATE FUNCTION get_available_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT;
```

**Benefits:**
- Reusable from other RPCs and raw queries
- Can be called from `SELECT` statements for list views
- Easy to unit test
- Read-only → no side effects → safe to call anywhere

---

### Layer 2 — Reservation primitives (write, with locks)

```sql
-- Atomically reserves N slots on a specific date.
-- Acquires FOR UPDATE lock on schedule_instances.
-- Raises exception if not enough slots or date is cancelled.
CREATE FUNCTION reserve_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT
) RETURNS VOID;

-- Releases N slots on a specific date (for loan returns).
-- Acquires FOR UPDATE lock and decrements slots_booked.
CREATE FUNCTION release_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT
) RETURNS VOID;

-- Reserves slots across a date range (for loan bookings).
-- Wraps reserve_slots_for_date in a loop.
-- All-or-nothing: if any day fails, the whole thing rolls back.
CREATE FUNCTION reserve_slots_for_range(
  p_schedule_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_quantity INT
) RETURNS VOID;

-- Same idea but for releases (loan returns spanning multiple days).
CREATE FUNCTION release_slots_for_range(
  p_schedule_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_quantity INT
) RETURNS VOID;
```

**Benefits:**
- The loan RPC reuses `reserve_slots_for_range` without duplicating logic
- Single-date purchases use `reserve_slots_for_date`
- Both functions use the same locking strategy → consistent race condition handling
- `release_slots_*` primitives enable the return flow

---

### Layer 3 — Snapshot creation helper

```sql
-- Creates a booking_schedule_snapshot for a given booking_item.
-- Fetches schedule + exception once, not twice like the current code.
CREATE FUNCTION create_schedule_snapshot(
  p_booking_item_id UUID,
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS VOID;
```

**Benefits:**
- Removes the duplicate schedule fetch in Phase 4 of the current RPC
- Can be called for both purchase bookings (single date) and loan bookings (could extend to snapshot loan fields too)

---

### Layer 4 — Orchestrators (thin wrappers)

```sql
-- Purchase booking (current behavior, using the new primitives)
CREATE FUNCTION create_booking_with_items(
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID;

-- NEW: Loan booking
-- Reserves slots across loan_start_date → loan_due_date for each item
CREATE FUNCTION create_loan_booking_with_items(
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID;

-- NEW: Return a loan item
-- Releases slots for the loan period
CREATE FUNCTION return_loan_item(
  p_booking_item_id UUID
) RETURNS VOID;
```

**Both orchestrators become much shorter** (maybe 40-60 lines each) because they delegate to the primitives. They just handle:
1. Parse JSONB input
2. Validate offering version (optimistic lock)
3. Call the right reservation primitive
4. Insert booking + booking_items + snapshots
5. Return the booking ID

---

## What the Refactor Unlocks

### 1. Dry-run availability checks from the frontend

With `get_available_slots` as a pure function, the frontend can query:

```sql
SELECT get_available_slots(schedule_id, '2026-04-15') AS available
```

No more guessing — the user sees real availability on the calendar before they tap "Book".

### 2. Loan booking becomes a ~30-line function

Current system would need to duplicate all of Phase 1 with a date-range loop. With the refactor:

```sql
CREATE FUNCTION create_loan_booking_with_items(...) RETURNS UUID AS $$
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Validate offering version
    PERFORM validate_offering_version(...);

    -- Reserve across the loan date range
    PERFORM reserve_slots_for_range(
      (v_item->>'schedule_id')::UUID,
      (v_item->>'loan_start_date')::DATE,
      (v_item->>'loan_due_date')::DATE,
      (v_item->>'quantity')::INT
    );
  END LOOP;

  -- Insert booking + items (mostly identical to purchase flow)
  -- ...
END;
$$;
```

### 3. Loan return becomes a ~20-line function

```sql
CREATE FUNCTION return_loan_item(p_booking_item_id UUID) RETURNS VOID AS $$
DECLARE
  v_item public.booking_items%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.booking_items WHERE id = p_booking_item_id;

  IF NOT v_item.is_loan THEN
    RAISE EXCEPTION 'Not a loan item';
  END IF;

  IF v_item.loan_returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already returned';
  END IF;

  -- Release slots across the loan period
  PERFORM release_slots_for_range(
    v_item.schedule_id,
    v_item.loan_start_date,
    v_item.loan_due_date,
    v_item.quantity
  );

  -- Mark as returned
  UPDATE public.booking_items
  SET loan_returned_at = now()
  WHERE id = p_booking_item_id;
END;
$$;
```

### 4. Better error messages

Each primitive can raise its own specific exception:
- `reserve_slots_for_date` → "Not enough slots for 2026-04-15: requested 3, available 2"
- `reserve_slots_for_range` → "Day 2026-04-17 fully booked in the requested range"
- Application layer catches these and maps them to user-friendly errors

### 5. Easier to test

Pure read-only helpers can be tested with simple SQL assertions. Reservation primitives can be tested in isolation. The orchestrators just need integration tests.

---

## Migration Strategy

### Phase A — Add new helpers alongside current RPC

1. Create the new functions (`get_effective_slots`, `get_available_slots`, `reserve_slots_for_date`, etc.) as **new additions**, don't touch the existing RPC
2. The current `create_booking_with_items` keeps working unchanged
3. No application changes required

### Phase B — Refactor existing RPC to use new helpers

1. Rewrite `create_booking_with_items` internally to call the new primitives
2. Behavior should be identical (same inputs → same outputs)
3. Test thoroughly — this is the risky part
4. No application changes required

### Phase C — Add loan functions

1. Create `create_loan_booking_with_items` and `return_loan_item`
2. Create new API routes that call them (separate from existing `/api/bookings`)
3. Add UI for loan bookings and returns
4. Feature-flag until tested in production

### Phase D — Cleanup

1. Add indexes suggested in the DB migration plan (`booking_items(is_loan, loan_due_date)`)
2. Add RLS policies for new loan statuses
3. Consider adding a `check_booking_availability` helper for dry-run checks from the frontend

---

## Open Questions

1. **Should the new helpers be `SECURITY DEFINER` or `SECURITY INVOKER`?**
   The current RPC is `SECURITY DEFINER` because customers need to lock `schedule_instances` (which they don't have SELECT on via RLS). The helpers should probably match — but read-only helpers could be `SECURITY INVOKER` if RLS allows members to read their community's schedules.

2. **Should reservation primitives be callable by authenticated users directly?**
   Probably not — they should only be called from within the orchestrators. Restricting via `GRANT EXECUTE` only to `service_role` keeps them as internal building blocks.

3. **Overdue detection — trigger or cron?**
   Option A: `pg_cron` job that runs nightly and flips `loaned_out` → `overdue` for items past `loan_due_date`. Option B: Check on every booking detail fetch (lazy). Option C: Both — cron for notifications, lazy check for accurate display.

4. **Cancellation behavior — should `cancel_booking` release slots?**
   For **loans**, yes — a cancelled loan should free up the reserved days. For **purchases**, the current behavior is to NOT release slots (prevents fraud, ensures inventory commitment). The refactor should preserve both behaviors.

5. **Do we need `reserve_slots_for_range` to support partial success?**
   Current thinking: no, all-or-nothing. If any day in the range is unavailable, the entire loan booking fails. This matches user expectations ("I want to borrow it for 7 days, not 3").

---

## File Organization

When implementing, keep the SQL organized:

```
docs/newdb/migrations/
├── 003_create_booking_rpc.sql          # original (to be replaced)
├── 007_slot_helpers.sql                # Phase A: new helpers
├── 008_refactor_booking_rpc.sql        # Phase B: rewritten RPC
└── 009_loan_rpcs.sql                   # Phase C: loan functions
```

Each migration is independent and can be reviewed/applied separately. Phase A is a pure add (safe), Phase B is a behavior-preserving refactor (risky, needs testing), Phase C adds new features.

---

## Effort Estimate

| Phase | What | Risk | Complexity |
|-------|------|------|------------|
| A | New helpers added alongside | Low | ~200 lines SQL |
| B | Refactor existing RPC | **High** (data-integrity critical) | ~100 lines, but needs thorough testing |
| C | Loan functions | Medium | ~150 lines SQL + API + UI |
| D | Cleanup (indexes, RLS, cron) | Low | ~50 lines |

**Total SQL:** ~500 lines, but much more readable and maintainable than the current 250-line monolith.

---

## Recommendation

Start with **Phase A** — build the new helpers without touching the existing RPC. This is a pure addition, zero risk, and it immediately gives you dry-run availability checks for the frontend.

Then assess: does Phase B (refactoring the current RPC) provide enough value to justify the testing effort? If the current RPC works fine and the only reason to refactor is "it's ugly," it might be better to leave it alone and just build the loan flow (Phase C) on top of the new primitives, accepting a little duplication.
