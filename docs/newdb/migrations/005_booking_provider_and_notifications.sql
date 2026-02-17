-- ============================================================================
-- Migration 005: Add provider_id to bookings + booking notification trigger
-- ============================================================================
--
-- Context:
--   Split-at-checkout guarantees one provider per booking (marketplace pattern).
--   Adding provider_id directly to bookings simplifies:
--     - RLS policies (no more items→offerings join for provider check)
--     - API access control (direct column check)
--     - Notification trigger (can fire on INSERT, no timing issue)
--     - Conversation creation (direct provider_id)
--
-- Also fixes:
--   - Bug: provider UPDATE policy was missing 'in_progress' status
--
-- Depends on: 003_create_booking_rpc.sql, 004_fix_booking_rls_recursion.sql
-- ============================================================================


-- ============================================================================
-- PART 1: Add provider_id column to bookings
-- ============================================================================

ALTER TABLE bookings
  ADD COLUMN provider_id UUID REFERENCES profiles(id) ON DELETE RESTRICT;

-- Backfill existing bookings: derive provider from first item's offering
UPDATE bookings b
SET provider_id = sub.provider_id
FROM (
  SELECT DISTINCT ON (bi.booking_id)
    bi.booking_id,
    o.provider_id
  FROM booking_items bi
  JOIN offerings o ON o.id = bi.offering_id
  ORDER BY bi.booking_id, bi.created_at ASC
) sub
WHERE b.id = sub.booking_id
  AND b.provider_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE bookings ALTER COLUMN provider_id SET NOT NULL;

-- Index for provider queries (e.g. "show my bookings as provider")
CREATE INDEX idx_bookings_provider ON bookings(provider_id, booking_status);


-- ============================================================================
-- PART 2: Simplify is_booking_provider() — direct column check
-- ============================================================================
-- Before: joined booking_items → offerings (3-table query)
-- After:  checks bookings.provider_id (single-table query)
--
-- All RLS policies using is_booking_provider() automatically benefit:
--   bookings, booking_status_history, booking_customer_snapshots,
--   booking_delivery_snapshots, booking_community_snapshots,
--   snapshot_addresses
-- ============================================================================

CREATE OR REPLACE FUNCTION is_booking_provider(p_booking_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = p_booking_id
    AND provider_id = get_current_profile_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- PART 3: Fix provider UPDATE policy — add missing 'in_progress'
-- ============================================================================
-- Bug: migration 004 WITH CHECK clause was:
--   booking_status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')
-- Missing 'in_progress' — providers couldn't transition to that status.
-- ============================================================================

DROP POLICY IF EXISTS "Providers can update booking status" ON bookings;
CREATE POLICY "Providers can update booking status"
  ON bookings FOR UPDATE
  USING (is_booking_provider(id))
  WITH CHECK (
    booking_status IN ('pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled')
  );


-- ============================================================================
-- PART 4: Booking notification trigger (INSERT + UPDATE)
-- ============================================================================
-- Fires on INSERT → notifies provider of new booking + creates initial
--   status history entry (NULL → pending).
-- Fires on UPDATE → notifies customer/provider on status changes + creates
--   status history entry.
--
-- Notifications inserted here trigger the existing notify_new_notification()
-- on the notifications table → pg_notify('notification_created', ...) →
-- PgNotifyManager → notification-listener → Socket.io (online) or
-- Expo Push (offline).
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_on_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_number TEXT;
  notify_customer  BOOLEAN := FALSE;
  notify_provider  BOOLEAN := FALSE;
  customer_ntype   TEXT;
  provider_ntype   TEXT;
  c_title          TEXT;
  c_body           TEXT;
  p_title          TEXT;
  p_body           TEXT;
BEGIN
  v_booking_number := NEW.booking_number;

  -- ===========================================================
  -- INSERT: New booking created → notify provider
  -- ===========================================================
  IF TG_OP = 'INSERT' THEN
    notify_provider := TRUE;
    provider_ntype  := 'booking_new';
    p_title         := 'New Booking';
    p_body          := format(
      'New booking #%s received. Please review and confirm.',
      v_booking_number
    );

    -- Initial status history entry (NULL → pending)
    INSERT INTO booking_status_history (
      booking_id, from_status, to_status, changed_by_id
    ) VALUES (
      NEW.id, NULL, NEW.booking_status, NEW.customer_id
    );

  -- ===========================================================
  -- UPDATE: Only act on actual status changes
  -- ===========================================================
  ELSIF OLD.booking_status IS NOT DISTINCT FROM NEW.booking_status THEN
    RETURN NEW;

  ELSE
    CASE NEW.booking_status
      WHEN 'confirmed' THEN
        notify_customer := TRUE;
        customer_ntype  := 'booking_confirmed';
        c_title         := 'Booking Confirmed';
        c_body          := format(
          'Your booking #%s has been confirmed!',
          v_booking_number
        );

      WHEN 'in_progress' THEN
        notify_customer := TRUE;
        customer_ntype  := 'booking_status_update';
        c_title         := 'Booking In Progress';
        c_body          := format(
          'Your booking #%s is now being prepared.',
          v_booking_number
        );

      WHEN 'ready' THEN
        notify_customer := TRUE;
        customer_ntype  := 'booking_status_update';
        c_title         := 'Booking Ready';
        c_body          := format(
          'Your booking #%s is ready!',
          v_booking_number
        );

      WHEN 'completed' THEN
        notify_customer := TRUE;
        customer_ntype  := 'booking_completed';
        c_title         := 'Booking Completed';
        c_body          := format(
          'Your booking #%s is complete. Thank you!',
          v_booking_number
        );
        notify_provider := TRUE;
        provider_ntype  := 'booking_completed';
        p_title         := 'Booking Completed';
        p_body          := format(
          'Booking #%s has been marked as completed.',
          v_booking_number
        );

      WHEN 'cancelled' THEN
        notify_customer := TRUE;
        customer_ntype  := 'booking_cancelled';
        c_title         := 'Booking Cancelled';
        c_body          := format(
          'Booking #%s has been cancelled.',
          v_booking_number
        );
        notify_provider := TRUE;
        provider_ntype  := 'booking_cancelled';
        p_title         := 'Booking Cancelled';
        p_body          := format(
          'Booking #%s has been cancelled.',
          v_booking_number
        );

      ELSE
        -- No notification for other statuses (e.g. refunded)
        NULL;
    END CASE;

    -- Status history audit trail
    INSERT INTO booking_status_history (
      booking_id, from_status, to_status, changed_by_id
    ) VALUES (
      NEW.id,
      OLD.booking_status,
      NEW.booking_status,
      COALESCE(NEW.cancelled_by_id, NEW.provider_id)
    );
  END IF;

  -- ===========================================================
  -- Insert notifications (triggers notify_new_notification)
  -- ===========================================================

  IF notify_customer AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO notifications (
      profile_id, notification_type, title, body,
      data_json, related_booking_id
    ) VALUES (
      NEW.customer_id,
      customer_ntype,
      c_title,
      c_body,
      jsonb_build_object(
        'booking_number', v_booking_number,
        'booking_status', NEW.booking_status::TEXT,
        'cancellation_reason', COALESCE(NEW.cancellation_reason, '')
      ),
      NEW.id
    );
  END IF;

  IF notify_provider AND NEW.provider_id IS NOT NULL THEN
    INSERT INTO notifications (
      profile_id, notification_type, title, body,
      data_json, related_booking_id
    ) VALUES (
      NEW.provider_id,
      provider_ntype,
      p_title,
      p_body,
      jsonb_build_object(
        'booking_number', v_booking_number,
        'booking_status', NEW.booking_status::TEXT
      ),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on both INSERT (new booking) and UPDATE (status changes)
CREATE TRIGGER tr_booking_status_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_booking_status_change();


-- ============================================================================
-- PART 5: Update create_booking_with_items RPC to accept provider_id
-- ============================================================================
-- Re-creates the function with provider_id in the Phase 2 INSERT.
-- All other logic (slot reservation, snapshots) remains identical.
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
  -- Phase 2: Create booking (now includes provider_id)
  -- ========================================================================
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
    total_amount
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

-- Permissions (re-grant after CREATE OR REPLACE)
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_booking_with_items(JSONB, JSONB) IS
'Creates booking with atomic slot reservation. Accepts provider_id for single-provider
bookings (split-at-checkout pattern). Uses SECURITY DEFINER to bypass RLS for FOR UPDATE
locks. Safe because the API route validates authorization before calling this function.';
