-- =============================================================================
-- Application functions and triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_community_creator_as_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO community_members (
    community_id,
    profile_id,
    join_method,
    membership_status,
    member_role,
    can_post_offerings,
    can_invite_members,
    membership_approved_at
  ) VALUES (
    NEW.id,
    NEW.created_by_profile_id,
    'direct_invite',
    'active',
    'owner',
    TRUE,
    TRUE,
    NOW()
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_conversation(p_booking_id uuid, p_creator_profile_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_customer_id UUID;
  v_provider_id UUID;
  v_existing_id UUID;
BEGIN
  -- 1. Verify booking exists and get participants
  SELECT customer_id, provider_id
  INTO v_customer_id, v_provider_id
  FROM bookings
  WHERE id = p_booking_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. Verify creator is a party to the booking
  IF p_creator_profile_id != v_customer_id AND p_creator_profile_id != v_provider_id THEN
    RAISE EXCEPTION 'Not a party to this booking';
  END IF;

  -- 3. Check for existing booking conversation (idempotent)
  SELECT id INTO v_existing_id
  FROM conversations
  WHERE booking_id = p_booking_id
    AND conversation_type = 'booking'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 4. Create conversation
  INSERT INTO conversations (conversation_type, booking_id, created_by_profile_id)
  VALUES ('booking', p_booking_id, p_creator_profile_id)
  RETURNING id INTO v_conversation_id;

  -- 5. Add both parties as participants
  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES
    (v_conversation_id, v_customer_id),
    (v_conversation_id, v_provider_id)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_conversation_with_request(p_booking_id uuid, p_booking jsonb, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
  v_customer_id UUID;
  v_provider_id UUID;
  v_total_amount NUMERIC;
  v_currency TEXT;
  v_items_summary JSONB;
  v_message_id UUID;
  v_offer_amount NUMERIC;
  v_offer_note TEXT;
BEGIN
  v_customer_id := (p_booking->>'customer_id')::UUID;
  v_provider_id := (p_booking->>'provider_id')::UUID;
  v_total_amount := (p_booking->>'total_amount')::NUMERIC;
  v_currency := COALESCE(p_booking->>'currency_code', 'EUR');

  -- Build items summary for the booking_request metadata
  SELECT jsonb_agg(jsonb_build_object(
    'snapshot_title', item->>'snapshot_title',
    'quantity', (item->>'quantity')::INT,
    'total_amount', (item->>'total_amount')::NUMERIC,
    'fulfillment_method', item->>'fulfillment_method',
    'is_loan', COALESCE((item->>'is_loan')::BOOLEAN, false),
    'instance_date', item->>'instance_date',
    'instance_start_time', item->>'instance_start_time'
  )) INTO v_items_summary
  FROM jsonb_array_elements(p_items) AS item;

  -- Create conversation
  INSERT INTO public.conversations (
    conversation_type,
    booking_id,
    created_by_profile_id
  ) VALUES (
    'booking',
    p_booking_id,
    v_customer_id
  ) RETURNING id INTO v_conversation_id;

  -- Add both parties as participants
  INSERT INTO public.conversation_participants (conversation_id, profile_id)
  VALUES
    (v_conversation_id, v_customer_id),
    (v_conversation_id, v_provider_id)
  ON CONFLICT DO NOTHING;

  -- Insert booking_request system message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    metadata
  ) VALUES (
    v_conversation_id,
    v_customer_id,
    'New booking request',
    'booking_request',
    jsonb_build_object(
      'booking_id', p_booking_id,
      'total_amount', v_total_amount,
      'currency', v_currency,
      'items_summary', COALESCE(v_items_summary, '[]'::JSONB)
    )
  ) RETURNING id INTO v_message_id;

  -- Update conversation last_message
  UPDATE public.conversations
  SET last_message_at = now(),
      last_message_preview = 'New booking request'
  WHERE id = v_conversation_id;

  -- If customer made an offer, create the price_offer
  v_offer_amount := (p_booking->>'offer_amount')::NUMERIC;
  v_offer_note := p_booking->>'offer_note';

  IF v_offer_amount IS NOT NULL THEN
    -- Insert offer message — use clock_timestamp() so it sorts strictly AFTER
    -- the booking_request inserted in the same transaction (default now() is
    -- the transaction start, which would tie with the previous insert).
    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      content,
      message_type,
      metadata,
      created_at
    ) VALUES (
      v_conversation_id,
      v_customer_id,
      COALESCE(v_offer_note, 'Made an offer'),
      'price_offer',
      jsonb_build_object(
        'offered_amount', v_offer_amount,
        'currency', v_currency,
        'note', v_offer_note
      ),
      clock_timestamp()
    ) RETURNING id INTO v_message_id;

    -- Insert price_offers row
    INSERT INTO public.price_offers (
      booking_id,
      conversation_id,
      message_id,
      offered_by,
      offered_amount,
      currency_code,
      note,
      offer_status
    ) VALUES (
      p_booking_id,
      v_conversation_id,
      v_message_id,
      v_customer_id,
      v_offer_amount,
      v_currency,
      v_offer_note,
      'pending'
    );

    -- Update the price_offer message metadata with the offer_id
    UPDATE public.messages
    SET metadata = metadata || jsonb_build_object(
      'offer_id', (SELECT id FROM public.price_offers WHERE message_id = v_message_id)
    )
    WHERE id = v_message_id;

    -- Update conversation preview
    UPDATE public.conversations
    SET last_message_at = now(),
        last_message_preview = 'Made an offer: ' || v_offer_amount || ' ' || v_currency
    WHERE id = v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_with_items(p_booking jsonb, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_booking_id UUID;
  v_booking_item_id UUID;
  v_conversation_id UUID;
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

  -- Phase 4: Customer / community / delivery / provider snapshots
  PERFORM public.insert_booking_aux_snapshots(v_booking_id, p_items);

  -- Phase 5: Create conversation + booking_request message (+ offer if present)
  v_conversation_id := public.create_booking_conversation_with_request(
    v_booking_id, p_booking, p_items
  );

  RETURN v_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_community_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  INSERT INTO conversations (conversation_type, community_id, created_by_profile_id)
  VALUES ('community', NEW.id, NEW.created_by_profile_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES (v_conversation_id, NEW.created_by_profile_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_direct_conversation(p_other_profile_id uuid, p_profile_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_share_community BOOLEAN;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify both users share at least one active community
  SELECT EXISTS (
    SELECT 1
    FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.profile_id = p_profile_id
      AND cm2.profile_id = p_other_profile_id
      AND cm1.membership_status = 'active'
      AND cm2.membership_status = 'active'
  ) INTO v_share_community;

  IF NOT v_share_community THEN
    RAISE EXCEPTION 'Users must share a common community to message each other';
  END IF;

  -- Check for existing direct conversation
  SELECT c.id INTO v_conversation_id
  FROM conversations c
  JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
  JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
  WHERE c.conversation_type = 'direct'
    AND cp1.profile_id = p_profile_id
    AND cp2.profile_id = p_other_profile_id
    AND cp1.left_at IS NULL AND cp1.removed_at IS NULL
    AND cp2.left_at IS NULL AND cp2.removed_at IS NULL
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create the conversation
  INSERT INTO conversations (conversation_type, created_by_profile_id)
  VALUES ('direct', p_profile_id)
  RETURNING id INTO v_conversation_id;

  -- Add both users as participants
  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES
    (v_conversation_id, p_profile_id),
    (v_conversation_id, p_other_profile_id);

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_schedule_snapshot(p_booking_item_id uuid, p_item jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.generate_booking_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_number = new_number) INTO exists_already;
    IF NOT exists_already THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_slots(p_schedule_id uuid, p_instance_date date) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_schedule_id uuid, p_instance_date date) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_effective_slots(p_schedule_id uuid, p_instance_date date) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_offering_approximate_location(p_offering_id uuid) RETURNS public.approximate_location
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  result approximate_location;
  addr RECORD;
BEGIN
  -- Get the offering's pickup address
  SELECT a.city, a.state, a.country, a.latitude, a.longitude, o.id AS offering_id
  INTO addr
  FROM offerings o
  JOIN addresses a ON o.pickup_address_id = a.id
  WHERE o.id = p_offering_id
    AND o.status = 'active'
    AND a.visibility = 'offering_pickup'
    AND a.is_active = TRUE
    AND a.deleted_at IS NULL;

  IF addr IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build result with randomized coordinates (~200m offset for privacy)
  -- Uses offering_id as seed for consistent randomization
  result.city := addr.city;
  result.state := addr.state;
  result.country := addr.country;
  result.approximate_latitude := addr.latitude +
    (('x' || SUBSTR(MD5(addr.offering_id::TEXT), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004;
  result.approximate_longitude := addr.longitude +
    (('x' || SUBSTR(MD5(addr.offering_id::TEXT || 'lng'), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_offerings_approximate_locations(p_offering_ids uuid[]) RETURNS TABLE(offering_id uuid, city text, state text, country text, approximate_latitude numeric, approximate_longitude numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS offering_id,
    a.city,
    a.state,
    a.country,
    a.latitude + (('x' || SUBSTR(MD5(o.id::TEXT), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004 AS approximate_latitude,
    a.longitude + (('x' || SUBSTR(MD5(o.id::TEXT || 'lng'), 1, 8))::BIT(32)::INT::DECIMAL / 2147483647 - 0.5) * 0.004 AS approximate_longitude
  FROM offerings o
  JOIN addresses a ON o.pickup_address_id = a.id
  WHERE o.id = ANY(p_offering_ids)
    AND o.status = 'active'
    AND a.visibility = 'offering_pickup'
    AND a.is_active = TRUE
    AND a.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_time_slots_for_date(p_schedule_id uuid, p_instance_date date) RETURNS TABLE(slot_start_time time without time zone, slot_end_time time without time zone, slots_available integer, slots_booked integer, is_available boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET
    -- Update email if changed
    email = COALESCE(NEW.email, email),

    -- Update verification status
    is_email_verified = (NEW.confirmed_at IS NOT NULL),

    -- Update last login time
    last_login_at = COALESCE(NEW.last_sign_in_at, last_login_at),

    -- Update avatar if provided by OAuth and we don't have one
    avatar_url = COALESCE(
      avatar_url,
      NEW.raw_user_meta_data->>'avatar_url'
    ),

    -- Update names if provided and currently empty
    first_name = COALESCE(
      NULLIF(first_name, ''),
      NEW.raw_user_meta_data->>'first_name',
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), ''),
      first_name
    ),
    last_name = COALESCE(
      NULLIF(last_name, ''),
      NEW.raw_user_meta_data->>'last_name',
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'full_name', '')) + 1), ''),
      last_name
    ),

    -- updated_at is handled by trigger
    updated_at = NOW()
  WHERE auth_user_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    auth_user_id,
    email,
    first_name,
    last_name,
    display_name,
    avatar_url,
    is_email_verified,
    last_login_at,
    preferred_language
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), ''),
      NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'name', ' ', 1), ''),
      'User'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN NEW.raw_user_meta_data->>'full_name') + 1), ''),
      NULLIF(SUBSTRING(NEW.raw_user_meta_data->>'name' FROM POSITION(' ' IN NEW.raw_user_meta_data->>'name') + 1), ''),
      'Unknown'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    (NEW.confirmed_at IS NOT NULL),
    NEW.last_sign_in_at,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'de')
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    is_email_verified = EXCLUDED.is_email_verified,
    last_login_at = EXCLUDED.last_login_at,
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    is_email_verified = (NEW.confirmed_at IS NOT NULL),
    last_login_at = NEW.last_sign_in_at,
    avatar_url = COALESCE(profiles.avatar_url, NEW.raw_user_meta_data->>'avatar_url'),
    updated_at = NOW()
  WHERE auth_user_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_offering_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_booking(p_booking jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.insert_booking_aux_snapshots(p_booking_id uuid, p_items jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_customer public.profiles%ROWTYPE;
  v_community public.communities%ROWTYPE;
  v_delivery_snapshot_id UUID;
  v_item JSONB;
  v_booking_item public.booking_items%ROWTYPE;
  v_offering public.offerings%ROWTYPE;
  v_provider public.profiles%ROWTYPE;
  v_pickup_snapshot_id UUID;
BEGIN
  -- Load booking
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- ─── Customer snapshot ────────────────────────────────────────────────────
  SELECT * INTO v_customer
  FROM public.profiles
  WHERE id = v_booking.customer_id;

  IF FOUND THEN
    INSERT INTO public.booking_customer_snapshots (
      booking_id,
      original_customer_id,
      snapshot_display_name,
      snapshot_first_name,
      snapshot_last_name,
      snapshot_email,
      snapshot_phone,
      snapshot_avatar_url
    ) VALUES (
      p_booking_id,
      v_customer.id,
      NULLIF(TRIM(CONCAT_WS(' ', v_customer.first_name, v_customer.last_name)), ''),
      v_customer.first_name,
      v_customer.last_name,
      v_customer.email,
      v_customer.phone,
      v_customer.avatar_url
    );
  END IF;

  -- ─── Community snapshot ───────────────────────────────────────────────────
  SELECT * INTO v_community
  FROM public.communities
  WHERE id = v_booking.community_id;

  IF FOUND THEN
    INSERT INTO public.booking_community_snapshots (
      booking_id,
      original_community_id,
      snapshot_community_name,
      snapshot_community_description,
      snapshot_community_image_url
    ) VALUES (
      p_booking_id,
      v_community.id,
      v_community.community_name,
      v_community.community_description,
      v_community.community_image_url
    );
  END IF;

  -- ─── Delivery snapshot (only if a delivery_address_id is set) ─────────────
  IF v_booking.delivery_address_id IS NOT NULL THEN
    v_delivery_snapshot_id := public.snapshot_address_from(v_booking.delivery_address_id);

    IF v_delivery_snapshot_id IS NOT NULL THEN
      INSERT INTO public.booking_delivery_snapshots (
        booking_id,
        snapshot_address_id
      ) VALUES (
        p_booking_id,
        v_delivery_snapshot_id
      );
    END IF;
  END IF;

  -- ─── Provider snapshots (one per booking_item) ────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Locate the booking_item that was just created for this offering.
    -- We match on (booking_id, offering_id) — the route enforces a single
    -- entry per offering per booking via cart deduplication.
    SELECT * INTO v_booking_item
    FROM public.booking_items
    WHERE booking_id = p_booking_id
      AND offering_id = (v_item->>'offering_id')::UUID
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Skip if we already created a provider snapshot for this item
    -- (booking_provider_snapshots.booking_item_id is UNIQUE).
    IF EXISTS (
      SELECT 1 FROM public.booking_provider_snapshots
      WHERE booking_item_id = v_booking_item.id
    ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_offering
    FROM public.offerings
    WHERE id = v_booking_item.offering_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_provider
    FROM public.profiles
    WHERE id = v_offering.provider_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Snapshot the provider's pickup address (if any)
    v_pickup_snapshot_id := public.snapshot_address_from(v_offering.pickup_address_id);

    INSERT INTO public.booking_provider_snapshots (
      booking_item_id,
      original_provider_id,
      snapshot_display_name,
      snapshot_avatar_url,
      snapshot_email,
      snapshot_phone,
      snapshot_address_id
    ) VALUES (
      v_booking_item.id,
      v_provider.id,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', v_provider.first_name, v_provider.last_name)), ''),
        'Unknown'
      ),
      v_provider.avatar_url,
      v_provider.email,
      v_provider.phone,
      v_pickup_snapshot_id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_booking_item(p_booking_id uuid, p_item jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.is_booking_customer(p_booking_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = p_booking_id
    AND customer_id = get_current_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_booking_provider(p_booking_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = p_booking_id
    AND provider_id = get_current_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(p_community_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
    AND member_role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND profile_id = get_current_profile_id()
    AND membership_status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND profile_id = get_current_profile_id()
    AND left_at IS NULL
    AND removed_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.join_community_via_invite_link(p_token text, p_profile_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_community_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_is_active BOOLEAN;
  v_current_count INT;
  v_max_members INT;
  v_member_id UUID;
  v_existing_status TEXT;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN json_build_object('error', 'Profile ID is required');
  END IF;

  SELECT id, invite_link_expires_at, is_active, current_members_count, max_members
  INTO v_community_id, v_expires_at, v_is_active, v_current_count, v_max_members
  FROM communities
  WHERE invite_link_token = p_token
    AND deleted_at IS NULL;

  IF v_community_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid invite link');
  END IF;

  IF NOT v_is_active THEN
    RETURN json_build_object('error', 'Community is not active');
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN json_build_object('error', 'Invite link has expired');
  END IF;

  IF v_current_count >= COALESCE(v_max_members, 100) THEN
    RETURN json_build_object('error', 'Community is full');
  END IF;

  SELECT id, membership_status INTO v_member_id, v_existing_status
  FROM community_members
  WHERE community_id = v_community_id AND profile_id = p_profile_id;

  IF v_existing_status = 'active' THEN
    RETURN json_build_object('success', true, 'already_member', true, 'member_id', v_member_id);
  END IF;

  IF v_member_id IS NOT NULL AND v_existing_status IN ('left', 'removed') THEN
    UPDATE community_members SET
      membership_status = 'active',
      join_method = 'invite_link',
      membership_approved_at = NOW(),
      membership_removed_at = NULL,
      removed_by_profile_id = NULL,
      removal_reason = NULL
    WHERE id = v_member_id;
    RETURN json_build_object('success', true, 'already_member', false, 'member_id', v_member_id);
  END IF;

  INSERT INTO community_members (
    community_id, profile_id, join_method, membership_status, membership_approved_at
  ) VALUES (
    v_community_id, p_profile_id, 'invite_link', 'active', NOW()
  )
  RETURNING id INTO v_member_id;

  RETURN json_build_object('success', true, 'already_member', false, 'member_id', v_member_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_type TEXT;
  v_community_id UUID;
  v_booking_id UUID;
BEGIN
  SELECT conversation_type, community_id, booking_id
  INTO v_conversation_type, v_community_id, v_booking_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  PERFORM pg_notify('message_created', json_build_object(
    'message_id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'conversation_type', v_conversation_type,
    'community_id', v_community_id,
    'booking_id', v_booking_id,
    'sender_id', NEW.sender_id,
    'content', LEFT(NEW.content, 7000),
    'created_at', NEW.created_at
  )::text);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_badge_count INT;
BEGIN
  -- Count unread notifications for this user
  SELECT COUNT(*) INTO v_badge_count
  FROM notifications
  WHERE profile_id = NEW.profile_id AND is_read = FALSE;

  PERFORM pg_notify('notification_created', json_build_object(
    'notification_id', NEW.id,
    'profile_id', NEW.profile_id,
    'notification_type', NEW.notification_type,
    'title', NEW.title,
    'body', NEW.body,
    'data_json', NEW.data_json,
    'related_booking_id', NEW.related_booking_id,
    'related_offering_id', NEW.related_offering_id,
    'related_community_id', NEW.related_community_id,
    'badge_count', v_badge_count,
    'created_at', NEW.created_at
  )::text);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_booking_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.release_slots_for_date(p_schedule_id uuid, p_instance_date date, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.schedule_instances
  SET
    slots_booked = GREATEST(slots_booked - p_quantity, 0),
    updated_at = now()
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = '00:00:00';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_slots_for_date(p_schedule_id uuid, p_instance_date date, p_quantity integer, p_slot_start_time time without time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.schedule_instances
  SET
    slots_booked = GREATEST(slots_booked - p_quantity, 0),
    updated_at = now()
  WHERE schedule_id = p_schedule_id
    AND instance_date = p_instance_date
    AND slot_start_time = p_slot_start_time;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_slots_for_range(p_schedule_id uuid, p_start_date date, p_end_date date, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.remove_member_from_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Only act when status changes away from 'active'
  IF NEW.membership_status = 'active' THEN
    RETURN NEW;
  END IF;
  IF OLD.membership_status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE community_id = NEW.community_id
    AND conversation_type = 'community'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    IF NEW.membership_status = 'left' THEN
      UPDATE conversation_participants
      SET left_at = NOW()
      WHERE conversation_id = v_conversation_id
        AND profile_id = NEW.profile_id;
    ELSIF NEW.membership_status = 'removed' THEN
      UPDATE conversation_participants
      SET removed_at = NOW(),
          removed_by_id = NEW.removed_by_profile_id
      WHERE conversation_id = v_conversation_id
        AND profile_id = NEW.profile_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_item_slots(p_item jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.reserve_slots_for_date(p_schedule_id uuid, p_instance_date date, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.reserve_slots_for_date(p_schedule_id uuid, p_instance_date date, p_quantity integer, p_slot_start_time time without time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.reserve_slots_for_range(p_schedule_id uuid, p_start_date date, p_end_date date, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.return_loan_item(p_booking_item_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.set_message_expiration() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  conv_type conversation_type;
BEGIN
  SELECT conversation_type INTO conv_type
  FROM conversations WHERE id = NEW.conversation_id;

  NEW.expires_at := CASE conv_type
    WHEN 'direct' THEN NOW() + INTERVAL '90 days'
    WHEN 'community' THEN NOW() + INTERVAL '1 year'
    WHEN 'booking' THEN NOW() + INTERVAL '7 years'
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.shares_community_with_current_user(p_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.profile_id = p_profile_id
    AND cm2.profile_id = get_current_profile_id()
    AND cm1.membership_status = 'active'
    AND cm2.membership_status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.snapshot_address_from(p_address_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_snapshot_id UUID;
BEGIN
  IF p_address_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.snapshot_addresses (
    original_address_id,
    street_name,
    street_number,
    apartment_unit,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    instructions
  )
  SELECT
    a.id,
    a.street_name,
    a.street_number,
    a.apartment_unit,
    a.city,
    a.postal_code,
    a.country,
    a.latitude,
    a.longitude,
    a.delivery_instructions
  FROM public.addresses a
  WHERE a.id = p_address_id
    AND a.deleted_at IS NULL
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_member_to_conversation_participant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Only act when membership_status becomes 'active'
  IF NEW.membership_status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Skip if this was already active (no change)
  IF TG_OP = 'UPDATE' AND OLD.membership_status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE community_id = NEW.community_id
    AND conversation_type = 'community'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, profile_id)
    VALUES (v_conversation_id, NEW.profile_id)
    ON CONFLICT (conversation_id, profile_id) DO UPDATE
      SET left_at = NULL, removed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_booking_status_update_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
  v_changed_by UUID;
  v_preview TEXT;
BEGIN
  -- Only fire when booking_status actually changed
  IF OLD.booking_status IS NOT DISTINCT FROM NEW.booking_status THEN
    RETURN NEW;
  END IF;

  -- Find the booking's conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE booking_id = NEW.id
    AND conversation_type = 'booking'
  LIMIT 1;

  -- No conversation yet (shouldn't happen after Phase B, but be safe)
  IF v_conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine who changed the status (best effort: cancelled_by_id or provider for forward transitions)
  IF NEW.booking_status = 'cancelled' AND NEW.cancelled_by_id IS NOT NULL THEN
    v_changed_by := NEW.cancelled_by_id;
  ELSE
    -- Forward transitions are typically provider-initiated
    v_changed_by := NEW.provider_id;
  END IF;

  v_preview := 'Booking ' || NEW.booking_status::TEXT;

  -- Insert status_update message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    metadata
  ) VALUES (
    v_conversation_id,
    v_changed_by,
    v_preview,
    'status_update',
    jsonb_build_object(
      'from_status', OLD.booking_status::TEXT,
      'to_status', NEW.booking_status::TEXT,
      'changed_by', v_changed_by
    )
  );

  -- Update conversation last_message
  UPDATE public.conversations
  SET last_message_at = now(),
      last_message_preview = v_preview
  WHERE id = v_conversation_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_address_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_community_member_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = NEW.community_id
      AND membership_status = 'active'
    )
    WHERE id = NEW.community_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE communities
    SET current_members_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = COALESCE(OLD.community_id, NEW.community_id)
      AND membership_status = 'active'
    )
    WHERE id = COALESCE(OLD.community_id, NEW.community_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_booking_not_own_offering() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM offerings o
    JOIN bookings b ON b.id = NEW.booking_id
    WHERE o.id = NEW.offering_id
    AND o.provider_id = b.customer_id
  ) THEN
    RAISE EXCEPTION 'Cannot book your own offering';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_offering_version(p_item jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


-- =============================================================================
-- Triggers
-- =============================================================================

DROP TRIGGER IF EXISTS add_creator_as_owner_on_community_create ON public.communities;
CREATE TRIGGER add_creator_as_owner_on_community_create AFTER INSERT ON public.communities FOR EACH ROW EXECUTE FUNCTION public.add_community_creator_as_owner();

DROP TRIGGER IF EXISTS create_conversation_on_community_insert ON public.communities;
CREATE TRIGGER create_conversation_on_community_insert AFTER INSERT ON public.communities FOR EACH ROW EXECUTE FUNCTION public.create_community_conversation();

DROP TRIGGER IF EXISTS increment_offering_version_on_update ON public.offerings;
CREATE TRIGGER increment_offering_version_on_update BEFORE UPDATE ON public.offerings FOR EACH ROW WHEN ((old.* IS DISTINCT FROM new.*)) EXECUTE FUNCTION public.increment_offering_version();

DROP TRIGGER IF EXISTS notify_on_message_insert ON public.messages;
CREATE TRIGGER notify_on_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

DROP TRIGGER IF EXISTS notify_on_notification_insert ON public.notifications;
CREATE TRIGGER notify_on_notification_insert AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_new_notification();

DROP TRIGGER IF EXISTS prevent_booking_own_offering ON public.booking_items;
CREATE TRIGGER prevent_booking_own_offering BEFORE INSERT ON public.booking_items FOR EACH ROW EXECUTE FUNCTION public.validate_booking_not_own_offering();

DROP TRIGGER IF EXISTS remove_member_from_conversation_on_leave ON public.community_members;
CREATE TRIGGER remove_member_from_conversation_on_leave AFTER UPDATE ON public.community_members FOR EACH ROW EXECUTE FUNCTION public.remove_member_from_conversation();

DROP TRIGGER IF EXISTS set_address_location ON public.addresses;
CREATE TRIGGER set_address_location BEFORE INSERT OR UPDATE OF latitude, longitude ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_address_location();

DROP TRIGGER IF EXISTS set_message_expiration_on_insert ON public.messages;
CREATE TRIGGER set_message_expiration_on_insert BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_message_expiration();

DROP TRIGGER IF EXISTS sync_member_to_conversation_on_join ON public.community_members;
CREATE TRIGGER sync_member_to_conversation_on_join AFTER INSERT OR UPDATE ON public.community_members FOR EACH ROW EXECUTE FUNCTION public.sync_member_to_conversation_participant();

DROP TRIGGER IF EXISTS tr_booking_status_change ON public.bookings;
CREATE TRIGGER tr_booking_status_change AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking_status_change();

DROP TRIGGER IF EXISTS tr_booking_status_change_message ON public.bookings;
CREATE TRIGGER tr_booking_status_change_message AFTER UPDATE OF booking_status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.tr_booking_status_update_message();

DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_schedules_updated_at ON public.availability_schedules;
CREATE TRIGGER update_availability_schedules_updated_at BEFORE UPDATE ON public.availability_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_invitations_updated_at ON public.community_invitations;
CREATE TRIGGER update_community_invitations_updated_at BEFORE UPDATE ON public.community_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_members_updated_at ON public.community_members;
CREATE TRIGGER update_community_members_updated_at BEFORE UPDATE ON public.community_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_posts_updated_at ON public.community_posts;
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.messages;
CREATE TRIGGER update_conversation_on_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_count_on_change ON public.community_members;
CREATE TRIGGER update_member_count_on_change AFTER INSERT OR DELETE OR UPDATE ON public.community_members FOR EACH ROW EXECUTE FUNCTION public.update_community_member_count();

DROP TRIGGER IF EXISTS update_offerings_updated_at ON public.offerings;
CREATE TRIGGER update_offerings_updated_at BEFORE UPDATE ON public.offerings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_exceptions_updated_at ON public.schedule_exceptions;
CREATE TRIGGER update_schedule_exceptions_updated_at BEFORE UPDATE ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_instances_updated_at ON public.schedule_instances;
CREATE TRIGGER update_schedule_instances_updated_at BEFORE UPDATE ON public.schedule_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

