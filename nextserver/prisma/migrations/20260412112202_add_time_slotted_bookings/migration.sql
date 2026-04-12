-- ============================================================================
-- Time-Slotted Bookings
--
-- Adds sub-day time-slot granularity for service offerings while keeping
-- loans, events, and products date-based.
--
-- Design rule: slot_duration_minutes IS NULL → date-based (sentinel 00:00).
--              slot_duration_minutes IS NOT NULL → time-slotted.
--
-- Changes:
--   1. Schema: new columns on 5 tables
--   2. RPCs: update existing + add new overloads + new query function
-- ============================================================================


-- ============================================================================
-- SCHEMA CHANGES
-- ============================================================================

-- availability_schedules: slot duration for time-slotted services
ALTER TABLE public.availability_schedules
  ADD COLUMN slot_duration_minutes INT;

ALTER TABLE public.availability_schedules
  ADD CONSTRAINT chk_slot_duration_positive
  CHECK (slot_duration_minutes IS NULL OR slot_duration_minutes > 0);

-- schedule_exceptions: per-date duration override
ALTER TABLE public.schedule_exceptions
  ADD COLUMN override_slot_duration_minutes INT;

ALTER TABLE public.schedule_exceptions
  ADD CONSTRAINT chk_exception_slot_duration_positive
  CHECK (override_slot_duration_minutes IS NULL OR override_slot_duration_minutes > 0);

-- schedule_instances: extend PK to include time slot
-- Existing rows get sentinel '00:00:00' via DEFAULT
ALTER TABLE public.schedule_instances
  ADD COLUMN slot_start_time TIME NOT NULL DEFAULT '00:00:00';

ALTER TABLE public.schedule_instances
  DROP CONSTRAINT schedule_instances_pkey;

ALTER TABLE public.schedule_instances
  ADD CONSTRAINT schedule_instances_pkey
  PRIMARY KEY (schedule_id, instance_date, slot_start_time);

-- booking_items: store the booked time slot
ALTER TABLE public.booking_items
  ADD COLUMN instance_start_time TIME,
  ADD COLUMN instance_end_time TIME;

-- booking_schedule_snapshots: capture duration at booking time
ALTER TABLE public.booking_schedule_snapshots
  ADD COLUMN snapshot_slot_duration_minutes INT,
  ADD COLUMN exception_override_slot_duration_minutes INT;


-- ============================================================================
-- LAYER 1: Read-only helpers (updated for new PK)
-- ============================================================================

-- get_booked_slots: add sentinel filter for date-based queries
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT slots_booked INTO v_count
  FROM public.schedule_instances
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = '00:00:00';

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- New: get_time_slots_for_date — compute available time slots for a date
CREATE OR REPLACE FUNCTION public.get_time_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE
) RETURNS TABLE (
  slot_start_time TIME,
  slot_end_time TIME,
  slots_available INT,
  slots_booked INT,
  is_available BOOLEAN
) AS $$
DECLARE
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
  v_effective_start TIME;
  v_effective_end TIME;
  v_effective_capacity INT;
  v_effective_duration INT;
  v_duration INTERVAL;
  v_current_start TIME;
  v_current_end TIME;
  v_booked INT;
BEGIN
  -- Load schedule
  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN RETURN; END IF;

  -- Not a time-slotted schedule → return nothing
  IF v_schedule.slot_duration_minutes IS NULL THEN RETURN; END IF;

  -- Check exception
  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = p_schedule_id AND exception_date = p_instance_date;

  IF FOUND AND v_exception.is_cancelled THEN RETURN; END IF;

  -- Effective values (exception overrides win)
  v_effective_start := COALESCE(v_exception.override_start_time, v_schedule.start_time);
  v_effective_end := COALESCE(v_exception.override_end_time, v_schedule.end_time);
  v_effective_capacity := COALESCE(v_exception.override_slots, v_schedule.slots_available);
  v_effective_duration := COALESCE(v_exception.override_slot_duration_minutes, v_schedule.slot_duration_minutes);
  v_duration := (v_effective_duration || ' minutes')::INTERVAL;

  -- Generate slots: step from start by duration, drop partial last slot
  v_current_start := v_effective_start;
  WHILE v_current_start + v_duration <= v_effective_end LOOP
    v_current_end := v_current_start + v_duration;

    -- Look up booked count for this specific time slot
    SELECT COALESCE(si.slots_booked, 0) INTO v_booked
    FROM public.schedule_instances si
    WHERE si.schedule_id = p_schedule_id
      AND si.instance_date = p_instance_date
      AND si.slot_start_time = v_current_start;

    IF NOT FOUND THEN
      v_booked := 0;
    END IF;

    RETURN QUERY SELECT
      v_current_start,
      v_current_end,
      v_effective_capacity,
      v_booked,
      (v_booked < v_effective_capacity);

    v_current_start := v_current_end;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================================
-- LAYER 2: Reservation primitives (updated for new PK)
-- ============================================================================

-- Existing 3-param reserve: add sentinel filter
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
  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule % not found or inactive', p_schedule_id;
  END IF;

  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = p_schedule_id AND exception_date = p_instance_date
  FOR UPDATE;

  IF FOUND AND v_exception.is_cancelled THEN
    RAISE EXCEPTION 'Schedule % is cancelled for date %', p_schedule_id, p_instance_date;
  END IF;

  v_effective_slots := COALESCE(v_exception.override_slots, v_schedule.slots_available);

  SELECT slots_booked INTO v_current_booked
  FROM public.schedule_instances
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = '00:00:00'
  FOR UPDATE;

  v_current_booked := COALESCE(v_current_booked, 0);

  IF v_current_booked + p_quantity > v_effective_slots THEN
    RAISE EXCEPTION 'Not enough slots for schedule % on %: requested %, available %',
      p_schedule_id, p_instance_date, p_quantity, (v_effective_slots - v_current_booked);
  END IF;

  INSERT INTO public.schedule_instances (schedule_id, instance_date, slot_start_time, slots_booked)
  VALUES (p_schedule_id, p_instance_date, '00:00:00', p_quantity)
  ON CONFLICT (schedule_id, instance_date, slot_start_time)
  DO UPDATE SET
    slots_booked = public.schedule_instances.slots_booked + p_quantity,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- New 4-param overload: reserve a specific time slot
CREATE OR REPLACE FUNCTION public.reserve_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT,
  p_slot_start_time TIME
) RETURNS VOID AS $$
DECLARE
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
  v_effective_slots INT;
  v_current_booked INT;
BEGIN
  SELECT * INTO v_schedule
  FROM public.availability_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule % not found or inactive', p_schedule_id;
  END IF;

  SELECT * INTO v_exception
  FROM public.schedule_exceptions
  WHERE schedule_id = p_schedule_id AND exception_date = p_instance_date
  FOR UPDATE;

  IF FOUND AND v_exception.is_cancelled THEN
    RAISE EXCEPTION 'Schedule % is cancelled for date %', p_schedule_id, p_instance_date;
  END IF;

  v_effective_slots := COALESCE(v_exception.override_slots, v_schedule.slots_available);

  SELECT slots_booked INTO v_current_booked
  FROM public.schedule_instances
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = p_slot_start_time
  FOR UPDATE;

  v_current_booked := COALESCE(v_current_booked, 0);

  IF v_current_booked + p_quantity > v_effective_slots THEN
    RAISE EXCEPTION 'Not enough slots for schedule % on % at %: requested %, available %',
      p_schedule_id, p_instance_date, p_slot_start_time,
      p_quantity, (v_effective_slots - v_current_booked);
  END IF;

  INSERT INTO public.schedule_instances (schedule_id, instance_date, slot_start_time, slots_booked)
  VALUES (p_schedule_id, p_instance_date, p_slot_start_time, p_quantity)
  ON CONFLICT (schedule_id, instance_date, slot_start_time)
  DO UPDATE SET
    slots_booked = public.schedule_instances.slots_booked + p_quantity,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Existing 3-param release: add sentinel filter
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
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = '00:00:00';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- New 4-param release: release a specific time slot
CREATE OR REPLACE FUNCTION public.release_slots_for_date(
  p_schedule_id UUID,
  p_instance_date DATE,
  p_quantity INT,
  p_slot_start_time TIME
) RETURNS VOID AS $$
BEGIN
  UPDATE public.schedule_instances
  SET
    slots_booked = GREATEST(slots_booked - p_quantity, 0),
    updated_at = now()
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = p_slot_start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- LAYER 3: Internal helpers (updated)
-- ============================================================================

-- reserve_item_slots: branch on instance_start_time for time-slotted
CREATE OR REPLACE FUNCTION public.reserve_item_slots(p_item JSONB)
RETURNS VOID AS $$
DECLARE
  v_is_loan BOOLEAN;
  v_schedule_id UUID;
  v_instance_date DATE;
  v_slot_start_time TIME;
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
    -- Multi-day loan reservation (always date-based)
    v_loan_start := (p_item->>'loan_start_date')::DATE;
    v_loan_due := (p_item->>'loan_due_date')::DATE;

    IF v_loan_start IS NULL OR v_loan_due IS NULL THEN
      RAISE EXCEPTION 'Loan item missing loan_start_date or loan_due_date';
    END IF;

    PERFORM public.reserve_slots_for_range(v_schedule_id, v_loan_start, v_loan_due, v_quantity);
  ELSE
    v_instance_date := (p_item->>'instance_date')::DATE;

    IF v_instance_date IS NULL THEN
      RAISE EXCEPTION 'Scheduled item missing instance_date';
    END IF;

    -- Check for time-slotted reservation
    v_slot_start_time := (p_item->>'instance_start_time')::TIME;

    IF v_slot_start_time IS NOT NULL THEN
      -- Time-slotted: reserve specific slot
      PERFORM public.reserve_slots_for_date(v_schedule_id, v_instance_date, v_quantity, v_slot_start_time);
    ELSE
      -- Date-based: reserve with sentinel
      PERFORM public.reserve_slots_for_date(v_schedule_id, v_instance_date, v_quantity);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- insert_booking_item: add instance_start_time / instance_end_time columns
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
    instance_start_time,
    instance_end_time,
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
    snapshot_price_type,
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
    (p_item->>'instance_start_time')::TIME,
    (p_item->>'instance_end_time')::TIME,
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
    (p_item->>'snapshot_price_type')::public.price_type,
    p_item->>'special_instructions',
    COALESCE((p_item->>'is_loan')::BOOLEAN, false),
    (p_item->>'loan_start_date')::DATE,
    (p_item->>'loan_due_date')::DATE,
    (p_item->>'deposit_amount')::NUMERIC
  ) RETURNING id INTO v_booking_item_id;

  RETURN v_booking_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- create_schedule_snapshot: capture slot_duration_minutes + exception override
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

  IF v_schedule_id IS NULL THEN
    RETURN;
  END IF;

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
    snapshot_slot_duration_minutes,
    snapshot_loan_duration_days,
    snapshot_loan_max_duration_days,
    had_exception,
    exception_id,
    exception_override_start_time,
    exception_override_end_time,
    exception_override_slots,
    exception_override_loan_duration_days,
    exception_override_slot_duration_minutes,
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
    v_schedule.slot_duration_minutes,
    v_schedule.loan_duration_days,
    v_schedule.loan_max_duration_days,
    v_had_exception,
    v_exception.id,
    v_exception.override_start_time,
    v_exception.override_end_time,
    v_exception.override_slots,
    v_exception.override_loan_duration_days,
    v_exception.override_slot_duration_minutes,
    v_exception.cancellation_reason,
    v_current_booked
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_time_slots_for_date(UUID, DATE) TO authenticated, service_role;

-- 4-param overloads: service_role only (called from within orchestrators)
REVOKE EXECUTE ON FUNCTION public.reserve_slots_for_date(UUID, DATE, INT, TIME) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_slots_for_date(UUID, DATE, INT, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_slots_for_date(UUID, DATE, INT, TIME) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_slots_for_date(UUID, DATE, INT, TIME) TO service_role;

COMMENT ON FUNCTION public.get_time_slots_for_date(UUID, DATE) IS
'Computes available time slots for a time-slotted schedule on a specific date. Returns empty if the schedule is date-based (slot_duration_minutes IS NULL) or cancelled. Respects exception overrides for time window, capacity, and slot duration.';
