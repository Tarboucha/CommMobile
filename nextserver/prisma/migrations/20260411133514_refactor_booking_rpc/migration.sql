-- ============================================================================
-- Migration 008: Refactor booking RPC into composable sub-functions
-- ============================================================================
-- Replaces the monolithic create_booking_with_items from migration 003.
--
-- Architecture:
--   - Pure read-only helpers (get_*)
--   - Reservation primitives (reserve_*, release_*) with row-level locks
--   - Insertion helpers (insert_*, create_*)
--   - Orchestrators: create_booking_with_items, return_loan_item
--
-- Handles all transaction types in a single unified flow:
--   - purchase / booking: single-date slot reservation
--   - loan: multi-day slot reservation across loan_start_date → loan_due_date
--   - free / no-schedule: no slot tracking
--
-- All sub-functions run inside the caller's transaction, so atomicity is
-- preserved: any failure rolls back the entire booking creation.
--
-- SECURITY DEFINER functions bypass RLS for FOR UPDATE locks on
-- schedule_instances and schedule_exceptions. Authorization is enforced
-- by the API layer before calling the orchestrators.
-- ============================================================================


-- ============================================================================
-- LAYER 1: Pure read-only helpers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Returns the effective slot capacity for a schedule on a specific date,
-- accounting for exceptions. Returns NULL if the schedule is cancelled
-- for that date or doesn't exist.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT AS $$
DECLARE
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
BEGIN
  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = p_schedule_id AND exception_date = p_instance_date;

  -- Cancelled exception → no slots available
  IF FOUND AND v_exception.is_cancelled THEN
    RETURN NULL;
  END IF;

  -- Use override if present, else the schedule default
  RETURN COALESCE(v_exception.override_slots, v_schedule.slots_available);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Returns the current number of booked slots for a schedule on a specific date.
-- Returns 0 if no schedule_instance row exists yet.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT slots_booked INTO v_count
  FROM public.schedule_instances
  WHERE schedule_id = p_schedule_id AND instance_date = p_instance_date;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Returns the number of available slots (effective - booked).
-- Returns NULL if the schedule doesn't exist or is cancelled for the date.
-- Usable from SELECT statements for calendar/availability queries.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT AS $$
DECLARE
  v_effective INT;
  v_booked INT;
BEGIN
  v_effective := public.get_effective_slots(p_schedule_id, p_instance_date);

  IF v_effective IS NULL THEN
    RETURN NULL;
  END IF;

  v_booked := public.get_booked_slots(p_schedule_id, p_instance_date);

  RETURN GREATEST(v_effective - v_booked, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================================
-- LAYER 2: Reservation primitives (write with row-level locks)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Atomically reserves N slots on a specific date for a schedule.
-- Acquires FOR UPDATE locks on schedule_exceptions and schedule_instances
-- to prevent race conditions with concurrent bookings.
-- Raises an exception if the schedule doesn't exist, is cancelled for that
-- date, or has insufficient available slots.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT
) RETURNS VOID AS $$
DECLARE
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
  v_effective_slots INT;
  v_current_booked INT;
BEGIN
  -- Load schedule
  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule % not found or inactive', p_schedule_id;
  END IF;

  -- Lock exception row (if exists) to prevent concurrent modifications
  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = p_schedule_id AND exception_date = p_instance_date
  FOR UPDATE;

  IF FOUND AND v_exception.is_cancelled THEN
    RAISE EXCEPTION 'Schedule % is cancelled for date %', p_schedule_id, p_instance_date;
  END IF;

  -- Compute effective slots (override or default)
  v_effective_slots := COALESCE(v_exception.override_slots, v_schedule.slots_available);

  -- Lock instance row (if exists) to prevent concurrent reservations
  SELECT slots_booked INTO v_current_booked
  FROM public.schedule_instances
  WHERE schedule_id = p_schedule_id AND instance_date = p_instance_date
  FOR UPDATE;

  v_current_booked := COALESCE(v_current_booked, 0);

  -- Check availability
  IF v_current_booked + p_quantity > v_effective_slots THEN
    RAISE EXCEPTION 'Not enough slots for schedule % on %: requested %, available %',
      p_schedule_id, p_instance_date, p_quantity, (v_effective_slots - v_current_booked);
  END IF;

  -- Reserve (upsert)
  INSERT INTO public.schedule_instances (schedule_id, instance_date, slots_booked)
  VALUES (p_schedule_id, p_instance_date, p_quantity)
  ON CONFLICT (schedule_id, instance_date)
  DO UPDATE SET
    slots_booked = public.schedule_instances.slots_booked + p_quantity,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Atomically reserves N slots across a date range (inclusive).
-- Used for loan bookings that span multiple days.
-- All-or-nothing: if any day in the range fails, the caller's transaction
-- rolls back, undoing any reservations made on earlier days.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_slots_for_range(
  p_schedule_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_quantity INT
) RETURNS VOID AS $$
DECLARE
  v_current_date DATE;
BEGIN
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range: end_date % is before start_date %',
      p_end_date, p_start_date;
  END IF;

  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    PERFORM public.reserve_slots_for_date(p_schedule_id, v_current_date, p_quantity);
    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Releases N slots on a specific date.
-- Used for loan returns. Safely clamps to 0 (never goes negative).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.schedule_instances
  SET
    slots_booked = GREATEST(slots_booked - p_quantity, 0),
    updated_at = now()
  WHERE schedule_id = p_schedule_id AND instance_date = p_instance_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Releases N slots across a date range (inclusive).
-- Used for loan returns spanning multiple days.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_slots_for_range(
  p_schedule_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_quantity INT
) RETURNS VOID AS $$
DECLARE
  v_current_date DATE;
BEGIN
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range: end_date % is before start_date %',
      p_end_date, p_start_date;
  END IF;

  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    PERFORM public.release_slots_for_date(p_schedule_id, v_current_date, p_quantity);
    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- LAYER 3: Internal helpers used by the orchestrator
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Validates the optimistic lock on an offering (version must match).
-- Raises exception if the offering doesn't exist or version has changed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_offering_version(p_item JSONB)
RETURNS VOID AS $$
DECLARE
  v_expected_version INT;
  v_current_version INT;
  v_offering_id UUID;
BEGIN
  v_offering_id := (p_item->>'offering_id')::UUID;
  v_expected_version := (p_item->>'offering_version')::INT;

  SELECT version INTO v_current_version
  FROM public.offerings
  WHERE id = v_offering_id;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Offering % not found', v_offering_id;
  END IF;

  IF v_current_version != v_expected_version THEN
    RAISE EXCEPTION 'Offering version mismatch for %: expected %, got %',
      v_offering_id, v_expected_version, v_current_version;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Reserves slots for a single booking item, dispatching to the right
-- primitive based on the item type:
--   - is_loan = true: reserve across loan_start_date → loan_due_date
--   - schedule_id + instance_date set: reserve single date
--   - neither set: no-op (unscheduled/free item)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_item_slots(p_item JSONB)
RETURNS VOID AS $$
DECLARE
  v_is_loan BOOLEAN;
  v_schedule_id UUID;
  v_instance_date DATE;
  v_loan_start DATE;
  v_loan_due DATE;
  v_quantity INT;
BEGIN
  v_is_loan := COALESCE((p_item->>'is_loan')::BOOLEAN, false);
  v_schedule_id := (p_item->>'schedule_id')::UUID;
  v_quantity := (p_item->>'quantity')::INT;

  -- No schedule → nothing to reserve
  IF v_schedule_id IS NULL THEN
    RETURN;
  END IF;

  IF v_is_loan THEN
    -- Multi-day loan reservation
    v_loan_start := (p_item->>'loan_start_date')::DATE;
    v_loan_due := (p_item->>'loan_due_date')::DATE;

    IF v_loan_start IS NULL OR v_loan_due IS NULL THEN
      RAISE EXCEPTION 'Loan item missing loan_start_date or loan_due_date';
    END IF;

    PERFORM public.reserve_slots_for_range(v_schedule_id, v_loan_start, v_loan_due, v_quantity);
  ELSE
    -- Single-date reservation (purchase, booking, scheduled service)
    v_instance_date := (p_item->>'instance_date')::DATE;

    IF v_instance_date IS NULL THEN
      RAISE EXCEPTION 'Scheduled item missing instance_date';
    END IF;

    PERFORM public.reserve_slots_for_date(v_schedule_id, v_instance_date, v_quantity);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Inserts a booking row from the JSONB payload and returns its ID.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_booking(p_booking JSONB)
RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  INSERT INTO public.bookings (
    booking_number,
    customer_id,
    provider_id,
    community_id,
    idempotency_key,
    booking_status,
    payment_method,
    payment_status,
    delivery_address_id,
    special_instructions,
    currency_code,
    subtotal_amount,
    service_fee_amount,
    total_amount,
    deposit_total,
    deposit_status
  ) VALUES (
    public.generate_booking_number(),
    (p_booking->>'customer_id')::UUID,
    (p_booking->>'provider_id')::UUID,
    (p_booking->>'community_id')::UUID,
    p_booking->>'idempotency_key',
    'pending'::public.booking_status,
    COALESCE((p_booking->>'payment_method')::public.payment_method, 'cash'),
    'pending'::public.payment_status,
    (p_booking->>'delivery_address_id')::UUID,
    p_booking->>'special_instructions',
    COALESCE(p_booking->>'currency_code', 'EUR'),
    (p_booking->>'subtotal_amount')::NUMERIC,
    COALESCE((p_booking->>'service_fee_amount')::NUMERIC, 0),
    (p_booking->>'total_amount')::NUMERIC,
    COALESCE((p_booking->>'deposit_total')::NUMERIC, 0),
    COALESCE(p_booking->>'deposit_status', 'none')
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Inserts a booking_item row from the JSONB payload and returns its ID.
-- Handles both single-date items (instance_date) and loan items
-- (loan_start_date / loan_due_date).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_booking_item(
  p_booking_id UUID,
  p_item JSONB
) RETURNS UUID AS $$
DECLARE
  v_booking_item_id UUID;
BEGIN
  INSERT INTO public.booking_items (
    booking_id,
    offering_id,
    schedule_id,
    instance_date,
    fulfillment_method,
    delivery_fee_amount,
    quantity,
    unit_price_amount,
    total_amount,
    currency_code,
    offering_version,
    snapshot_title,
    snapshot_description,
    snapshot_image_url,
    snapshot_category,
    snapshot_transaction_type,
    special_instructions,
    is_loan,
    loan_start_date,
    loan_due_date,
    deposit_amount
  ) VALUES (
    p_booking_id,
    (p_item->>'offering_id')::UUID,
    (p_item->>'schedule_id')::UUID,
    (p_item->>'instance_date')::DATE,
    (p_item->>'fulfillment_method')::public.fulfillment_method,
    COALESCE((p_item->>'delivery_fee_amount')::NUMERIC, 0),
    (p_item->>'quantity')::INT,
    (p_item->>'unit_price_amount')::NUMERIC,
    (p_item->>'total_amount')::NUMERIC,
    COALESCE(p_item->>'currency_code', 'EUR'),
    (p_item->>'offering_version')::INT,
    p_item->>'snapshot_title',
    p_item->>'snapshot_description',
    p_item->>'snapshot_image_url',
    (p_item->>'snapshot_category')::public.offering_category,
    (p_item->>'snapshot_transaction_type')::public.transaction_type,
    p_item->>'special_instructions',
    COALESCE((p_item->>'is_loan')::BOOLEAN, false),
    (p_item->>'loan_start_date')::DATE,
    (p_item->>'loan_due_date')::DATE,
    (p_item->>'deposit_amount')::NUMERIC
  ) RETURNING id INTO v_booking_item_id;

  RETURN v_booking_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Creates a booking_schedule_snapshot for a booking_item.
-- No-op if the item has no schedule (unscheduled/free items).
-- Fetches schedule + exception once, reducing duplicate queries.
-- Captures loan fields if applicable.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_schedule_snapshot(
  p_booking_item_id UUID,
  p_item JSONB
) RETURNS VOID AS $$
DECLARE
  v_schedule_id UUID;
  v_reference_date DATE;
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
  v_had_exception BOOLEAN := false;
  v_current_booked INT;
BEGIN
  v_schedule_id := (p_item->>'schedule_id')::UUID;

  -- No schedule → no snapshot needed
  IF v_schedule_id IS NULL THEN
    RETURN;
  END IF;

  -- For loans, use loan_start_date as the exception-lookup reference date.
  -- For single-date items, use instance_date.
  IF COALESCE((p_item->>'is_loan')::BOOLEAN, false) THEN
    v_reference_date := (p_item->>'loan_start_date')::DATE;
  ELSE
    v_reference_date := (p_item->>'instance_date')::DATE;
  END IF;

  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = v_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule % not found when creating snapshot', v_schedule_id;
  END IF;

  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = v_schedule_id AND exception_date = v_reference_date;

  IF FOUND THEN
    v_had_exception := true;
  END IF;

  -- Current booked count for the reference date (informational, post-reservation)
  v_current_booked := public.get_booked_slots(v_schedule_id, v_reference_date);

  INSERT INTO public.booking_schedule_snapshots (
    booking_item_id,
    original_schedule_id,
    snapshot_dtstart,
    snapshot_dtend,
    snapshot_rrule,
    snapshot_start_time,
    snapshot_end_time,
    snapshot_slots_available,
    snapshot_slot_unit,
    snapshot_slot_label,
    snapshot_loan_duration_days,
    snapshot_loan_max_duration_days,
    had_exception,
    exception_id,
    exception_override_start_time,
    exception_override_end_time,
    exception_override_slots,
    exception_override_loan_duration_days,
    exception_reason,
    slots_booked_at_booking
  ) VALUES (
    p_booking_item_id,
    v_schedule_id,
    v_schedule.dtstart,
    v_schedule.dtend,
    v_schedule.rrule,
    COALESCE(v_exception.override_start_time, v_schedule.start_time),
    COALESCE(v_exception.override_end_time, v_schedule.end_time),
    v_schedule.slots_available,
    v_schedule.slot_unit,
    v_schedule.slot_label,
    v_schedule.loan_duration_days,
    v_schedule.loan_max_duration_days,
    v_had_exception,
    v_exception.id,
    v_exception.override_start_time,
    v_exception.override_end_time,
    v_exception.override_slots,
    v_exception.override_loan_duration_days,
    v_exception.cancellation_reason,
    v_current_booked
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- LAYER 4: Orchestrators (public entry points)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Main orchestrator: creates a booking atomically with all its items.
-- Handles all transaction types (purchase, booking, loan, free) through
-- unified sub-function calls.
--
-- Flow:
--   1. For each item: validate version + reserve slots
--   2. Insert booking
--   3. For each item: insert booking_item + create schedule snapshot
--
-- All steps run in the caller's transaction — any failure rolls back
-- the entire operation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_with_items(
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
  v_booking_item_id UUID;
  v_item JSONB;
BEGIN
  -- Phase 1: Validate + reserve slots for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    PERFORM public.validate_offering_version(v_item);
    PERFORM public.reserve_item_slots(v_item);
  END LOOP;

  -- Phase 2: Create the booking row
  v_booking_id := public.insert_booking(p_booking);

  -- Phase 3: Create booking items + schedule snapshots
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_booking_item_id := public.insert_booking_item(v_booking_id, v_item);
    PERFORM public.create_schedule_snapshot(v_booking_item_id, v_item);
  END LOOP;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Return a loan item: releases the reserved slots across the loan period
-- and marks the item as returned.
--
-- Raises exception if:
--   - The item is not a loan
--   - The item has already been returned
--   - The item has no loan_start_date / loan_due_date
--
-- If all items in the booking are returned, the booking status is updated
-- to 'returned'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_loan_item(
  p_booking_item_id UUID
) RETURNS VOID AS $$
DECLARE
  v_item public.booking_items%ROWTYPE;
  v_unreturned_count INT;
BEGIN
  -- Load the booking item
  SELECT * INTO v_item
  FROM public.booking_items
  WHERE id = p_booking_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking item % not found', p_booking_item_id;
  END IF;

  IF NOT v_item.is_loan THEN
    RAISE EXCEPTION 'Booking item % is not a loan', p_booking_item_id;
  END IF;

  IF v_item.loan_returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Booking item % has already been returned', p_booking_item_id;
  END IF;

  IF v_item.loan_start_date IS NULL OR v_item.loan_due_date IS NULL THEN
    RAISE EXCEPTION 'Loan item % missing loan dates', p_booking_item_id;
  END IF;

  IF v_item.schedule_id IS NULL THEN
    RAISE EXCEPTION 'Loan item % has no schedule to release slots on', p_booking_item_id;
  END IF;

  -- Release slots across the loan period
  PERFORM public.release_slots_for_range(
    v_item.schedule_id,
    v_item.loan_start_date,
    v_item.loan_due_date,
    v_item.quantity
  );

  -- Mark the item as returned
  UPDATE public.booking_items
  SET loan_returned_at = now()
  WHERE id = p_booking_item_id;

  -- If all items in this booking are now returned, update the booking status
  SELECT COUNT(*) INTO v_unreturned_count
  FROM public.booking_items
  WHERE booking_id = v_item.booking_id
    AND is_loan = true
    AND loan_returned_at IS NULL;

  IF v_unreturned_count = 0 THEN
    UPDATE public.bookings
    SET
      booking_status = 'returned'::public.booking_status,
      updated_at = now()
    WHERE id = v_item.booking_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Permissions
-- ============================================================================

-- Read-only helpers: safe to expose to authenticated users (read their own data)
GRANT EXECUTE ON FUNCTION public.get_effective_slots(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE) TO authenticated, service_role;

-- Reservation primitives and internal helpers: service_role only
-- They should only be called from within the orchestrators, not directly.
REVOKE EXECUTE ON FUNCTION public.reserve_slots_for_date(UUID, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_slots_for_range(UUID, DATE, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_slots_for_date(UUID, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_slots_for_range(UUID, DATE, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_offering_version(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_item_slots(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_booking(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_booking_item(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_schedule_snapshot(UUID, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_slots_for_date(UUID, DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_slots_for_range(UUID, DATE, DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_slots_for_date(UUID, DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_slots_for_range(UUID, DATE, DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_offering_version(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_item_slots(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_booking(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_booking_item(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_schedule_snapshot(UUID, JSONB) TO service_role;

-- Public orchestrators
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(JSONB, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.return_loan_item(UUID) TO authenticated, service_role;


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.get_effective_slots(UUID, DATE) IS
'Returns the effective slot capacity for a schedule on a specific date, applying exception overrides. NULL if cancelled or not found.';

COMMENT ON FUNCTION public.get_available_slots(UUID, DATE) IS
'Returns available slots (effective - booked) for a schedule on a specific date. Safe to call from SELECT queries for calendar views.';

COMMENT ON FUNCTION public.reserve_slots_for_date(UUID, DATE, INT) IS
'Atomically reserves N slots on a date. Acquires FOR UPDATE locks for race-condition safety.';

COMMENT ON FUNCTION public.reserve_slots_for_range(UUID, DATE, DATE, INT) IS
'Reserves slots across a date range (inclusive). All-or-nothing via transaction rollback.';

COMMENT ON FUNCTION public.create_booking_with_items(JSONB, JSONB) IS
'Main booking orchestrator. Creates a booking atomically with all items, handling purchase, booking, loan, and free transaction types through unified sub-functions.';

COMMENT ON FUNCTION public.return_loan_item(UUID) IS
'Returns a loan item, releasing reserved slots across the loan period. Updates booking status to "returned" when all loan items in the booking are returned.';
