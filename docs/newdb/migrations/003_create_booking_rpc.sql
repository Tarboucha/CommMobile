-- ============================================================================
-- Migration 003: create_booking_with_items RPC
-- ============================================================================
-- Atomic booking creation with slot reservation.
-- Pattern adapted from create_order_with_reservation in the original project.
--
-- SECURITY DEFINER: needed for FOR UPDATE locks on schedule_exceptions and
-- schedule_instances (customers only have SELECT via RLS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_booking_with_items(
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
  v_booking_item_id UUID;
  v_item JSONB;
  v_schedule_id UUID;
  v_instance_date DATE;
  v_quantity INT;
  v_offering_version INT;
  v_current_offering_version INT;
  v_schedule public.availability_schedules%ROWTYPE;
  v_exception public.schedule_exceptions%ROWTYPE;
  v_effective_slots INT;
  v_current_booked INT;
  v_had_exception BOOLEAN;
BEGIN
  -- ========================================================================
  -- Phase 1: For each item — validate versions & reserve slots
  -- ========================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_offering_version := (v_item->>'offering_version')::INT;

    -- 1a. Validate offering version (optimistic lock)
    SELECT version INTO v_current_offering_version
    FROM public.offerings
    WHERE id = (v_item->>'offering_id')::UUID;

    IF v_current_offering_version IS NULL THEN
      RAISE EXCEPTION 'Offering % not found', v_item->>'offering_id';
    END IF;

    IF v_current_offering_version != v_offering_version THEN
      RAISE EXCEPTION 'Offering version mismatch for %: expected %, got %',
        v_item->>'offering_id', v_offering_version, v_current_offering_version;
    END IF;

    -- 1b. Reserve slots (only for items with schedule_id + instance_date)
    v_schedule_id := (v_item->>'schedule_id')::UUID;
    v_instance_date := (v_item->>'instance_date')::DATE;
    v_quantity := (v_item->>'quantity')::INT;

    IF v_schedule_id IS NOT NULL AND v_instance_date IS NOT NULL THEN
      -- Load schedule (no FOR UPDATE needed — we don't modify it)
      SELECT * INTO v_schedule
      FROM public.availability_schedules
      WHERE id = v_schedule_id AND is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found or inactive', v_schedule_id;
      END IF;

      -- Check for exception with FOR UPDATE (race condition protection)
      v_had_exception := false;
      SELECT * INTO v_exception
      FROM public.schedule_exceptions
      WHERE schedule_id = v_schedule_id AND exception_date = v_instance_date
      FOR UPDATE;

      IF FOUND THEN
        v_had_exception := true;
        IF v_exception.is_cancelled THEN
          RAISE EXCEPTION 'Schedule % is cancelled for date %', v_schedule_id, v_instance_date;
        END IF;
      END IF;

      -- Compute effective slots
      v_effective_slots := COALESCE(v_exception.override_slots, v_schedule.slots_available);

      -- Get current booked count with FOR UPDATE (race condition protection)
      SELECT slots_booked INTO v_current_booked
      FROM public.schedule_instances
      WHERE schedule_id = v_schedule_id AND instance_date = v_instance_date
      FOR UPDATE;

      v_current_booked := COALESCE(v_current_booked, 0);

      -- Check availability
      IF v_current_booked + v_quantity > v_effective_slots THEN
        RAISE EXCEPTION 'Not enough slots for schedule % on %: requested %, available %',
          v_schedule_id, v_instance_date, v_quantity, (v_effective_slots - v_current_booked);
      END IF;

      -- Reserve slots (UPSERT)
      INSERT INTO public.schedule_instances (schedule_id, instance_date, slots_booked)
      VALUES (v_schedule_id, v_instance_date, v_quantity)
      ON CONFLICT (schedule_id, instance_date)
      DO UPDATE SET
        slots_booked = public.schedule_instances.slots_booked + v_quantity,
        updated_at = now();
    END IF;
  END LOOP;

  -- ========================================================================
  -- Phase 2: Create booking
  -- ========================================================================
  INSERT INTO public.bookings (
    booking_number,
    customer_id,
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
    total_amount
  ) VALUES (
    public.generate_booking_number(),
    (p_booking->>'customer_id')::UUID,
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
    (p_booking->>'total_amount')::NUMERIC
  ) RETURNING id INTO v_booking_id;

  -- ========================================================================
  -- Phase 3: Create booking_items with inline offering snapshots
  -- ========================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_schedule_id := (v_item->>'schedule_id')::UUID;
    v_instance_date := (v_item->>'instance_date')::DATE;

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
      special_instructions
    ) VALUES (
      v_booking_id,
      (v_item->>'offering_id')::UUID,
      v_schedule_id,
      v_instance_date,
      (v_item->>'fulfillment_method')::public.fulfillment_method,
      COALESCE((v_item->>'delivery_fee_amount')::NUMERIC, 0),
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price_amount')::NUMERIC,
      (v_item->>'total_amount')::NUMERIC,
      COALESCE(v_item->>'currency_code', 'EUR'),
      (v_item->>'offering_version')::INT,
      v_item->>'snapshot_title',
      v_item->>'snapshot_description',
      v_item->>'snapshot_image_url',
      (v_item->>'snapshot_category')::public.offering_category,
      v_item->>'special_instructions'
    ) RETURNING id INTO v_booking_item_id;

    -- ==================================================================
    -- Phase 4: Create schedule snapshot (if scheduled item)
    -- ==================================================================
    IF v_schedule_id IS NOT NULL THEN
      -- Reload schedule and exception for snapshot data
      SELECT * INTO v_schedule
      FROM public.availability_schedules
      WHERE id = v_schedule_id;

      v_had_exception := false;
      SELECT * INTO v_exception
      FROM public.schedule_exceptions
      WHERE schedule_id = v_schedule_id AND exception_date = v_instance_date;

      IF FOUND THEN
        v_had_exception := true;
      END IF;

      -- Current booked count for snapshot
      SELECT slots_booked INTO v_current_booked
      FROM public.schedule_instances
      WHERE schedule_id = v_schedule_id AND instance_date = v_instance_date;

      v_current_booked := COALESCE(v_current_booked, 0);

      INSERT INTO public.booking_schedule_snapshots (
        booking_item_id,
        original_schedule_id,
        snapshot_dtstart,
        snapshot_dtend,
        snapshot_rrule,
        snapshot_start_time,
        snapshot_end_time,
        snapshot_slots_available,
        snapshot_slot_label,
        had_exception,
        exception_id,
        exception_override_start_time,
        exception_override_end_time,
        exception_override_slots,
        exception_reason,
        slots_booked_at_booking
      ) VALUES (
        v_booking_item_id,
        v_schedule_id,
        v_schedule.dtstart,
        v_schedule.dtend,
        v_schedule.rrule,
        COALESCE(v_exception.override_start_time, v_schedule.start_time),
        COALESCE(v_exception.override_end_time, v_schedule.end_time),
        v_schedule.slots_available,
        v_schedule.slot_label,
        v_had_exception,
        v_exception.id,
        v_exception.override_start_time,
        v_exception.override_end_time,
        v_exception.override_slots,
        v_exception.cancellation_reason,
        v_current_booked
      );
    END IF;
  END LOOP;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_booking_with_items(JSONB, JSONB) IS
'Creates booking with atomic slot reservation. Uses SECURITY DEFINER to bypass RLS
for FOR UPDATE locks on schedule_exceptions and schedule_instances.
Safe because the API route validates authorization before calling this function.';
