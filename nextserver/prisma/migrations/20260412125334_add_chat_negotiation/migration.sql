-- ============================================================================
-- Chat Negotiation: structured messages, price offers, atomic conversation
-- creation, and status update system messages.
--
-- Phases A + B + C combined into one migration:
--   A. Schema: message_type enum, metadata on messages, price_offers table,
--      accepted_offer_id on bookings
--   B. RPC: extend create_booking_with_items to create conversation +
--      booking_request message atomically
--   C. Trigger: insert status_update messages on booking status changes
-- ============================================================================


-- ============================================================================
-- PHASE A: SCHEMA
-- ============================================================================

-- New enum for structured message types
CREATE TYPE public.message_type AS ENUM (
  'text',
  'booking_request',
  'price_offer',
  'offer_response',
  'status_update'
);

-- Extend messages with type + metadata
ALTER TABLE public.messages
  ADD COLUMN message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN metadata JSONB;

-- Price offers table
CREATE TABLE public.price_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id      UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  offered_by      UUID NOT NULL REFERENCES public.profiles(id),
  offered_amount  NUMERIC(10,2) NOT NULL,
  currency_code   TEXT NOT NULL DEFAULT 'EUR',
  note            TEXT,
  offer_status    TEXT NOT NULL DEFAULT 'pending'
    CHECK (offer_status IN ('pending', 'accepted', 'declined', 'expired', 'superseded')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_offers_booking ON public.price_offers(booking_id);
CREATE INDEX idx_price_offers_pending ON public.price_offers(booking_id)
  WHERE offer_status = 'pending';
CREATE INDEX idx_price_offers_message ON public.price_offers(message_id);

-- FK from bookings to the accepted offer (O(1) lookup for agreed price)
ALTER TABLE public.bookings
  ADD COLUMN accepted_offer_id UUID REFERENCES public.price_offers(id);

-- RLS for price_offers: participants can read offers for their bookings
ALTER TABLE public.price_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view offers"
  ON public.price_offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = price_offers.booking_id
        AND (b.customer_id = public.get_current_profile_id()
          OR b.provider_id = public.get_current_profile_id())
    )
  );


-- ============================================================================
-- PHASE B: ATOMIC CONVERSATION CREATION IN BOOKING RPC
-- ============================================================================

-- New helper: creates conversation + participants + booking_request message
-- Called from create_booking_with_items after snapshots.
CREATE OR REPLACE FUNCTION public.create_booking_conversation_with_request(
  p_booking_id UUID,
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID AS $$
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
    -- Insert offer message
    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      content,
      message_type,
      metadata
    ) VALUES (
      v_conversation_id,
      v_customer_id,
      COALESCE(v_offer_note, 'Made an offer'),
      'price_offer',
      jsonb_build_object(
        'offered_amount', v_offer_amount,
        'currency', v_currency,
        'note', v_offer_note
      )
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update main orchestrator to call conversation creation
CREATE OR REPLACE FUNCTION public.create_booking_with_items(
  p_booking JSONB,
  p_items JSONB
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE C: STATUS UPDATE TRIGGER
-- ============================================================================

-- Trigger function: insert a status_update message when booking_status changes
CREATE OR REPLACE FUNCTION public.tr_booking_status_update_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (UPDATE only, not INSERT — INSERT is handled by the RPC)
DROP TRIGGER IF EXISTS tr_booking_status_change_message ON public.bookings;
CREATE TRIGGER tr_booking_status_change_message
  AFTER UPDATE OF booking_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_booking_status_update_message();


-- ============================================================================
-- PERMISSIONS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.create_booking_conversation_with_request(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_conversation_with_request(UUID, JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_booking_conversation_with_request(UUID, JSONB, JSONB) IS
'Creates a booking conversation with participants and a booking_request system message. Optionally creates an initial price_offer if offer_amount is present in the booking payload.';

COMMENT ON FUNCTION public.tr_booking_status_update_message() IS
'Trigger function that inserts a status_update message into the booking conversation whenever booking_status changes.';
