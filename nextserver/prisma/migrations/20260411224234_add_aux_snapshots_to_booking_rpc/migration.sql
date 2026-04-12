-- ============================================================================
-- Snapshot consistency + atomic snapshot creation in the booking RPC
--
-- Changes:
--   1. Add snapshot_price_type to booking_items (closes the price_type
--      gap — fixed/negotiable/free/donation now survives offering edits).
--   2. Update insert_booking_item to populate snapshot_price_type.
--   3. New helper function insert_booking_aux_snapshots(p_booking_id, p_items)
--      that creates customer / provider / community / delivery snapshots
--      from current DB state, atomically inside the booking transaction.
--   4. Update create_booking_with_items to call the new helper.
--
-- Why: previously the route handler created these snapshots after the RPC
-- returned, using the user's JWT. The snapshot tables have no INSERT RLS
-- policies, so every snapshot insert was silently failing — leaving
-- bookings with no provider/customer/community/delivery snapshots.
-- Moving everything inside the SECURITY DEFINER RPC bypasses RLS, makes
-- the whole booking atomic, and gives a single source of truth.
-- ============================================================================

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN "snapshot_price_type" "price_type";


-- ----------------------------------------------------------------------------
-- insert_booking_item — updated to populate snapshot_price_type
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


-- ----------------------------------------------------------------------------
-- snapshot_address_from — copies an addresses row into snapshot_addresses
-- and returns the new snapshot id. Returns NULL if the source address
-- does not exist or has been soft-deleted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_address_from(
  p_address_id UUID
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- insert_booking_aux_snapshots — creates customer / provider / community
-- / delivery snapshots for a freshly created booking. Reads source data
-- directly from profiles / offerings / communities / addresses so the
-- caller does not need to pre-fetch.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_booking_aux_snapshots(
  p_booking_id UUID,
  p_items JSONB
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- create_booking_with_items — updated to call insert_booking_aux_snapshots
-- so all snapshot creation is atomic with the booking row.
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

  -- Phase 4: Customer / community / delivery / provider snapshots
  PERFORM public.insert_booking_aux_snapshots(v_booking_id, p_items);

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Permissions
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.snapshot_address_from(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_booking_aux_snapshots(UUID, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.snapshot_address_from(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_booking_aux_snapshots(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.insert_booking_aux_snapshots(UUID, JSONB) IS
'Creates customer/provider/community/delivery snapshots for a booking. Called by create_booking_with_items so snapshot creation is atomic with the booking row. Reads source data directly from profiles/offerings/communities/addresses.';

COMMENT ON FUNCTION public.snapshot_address_from(UUID) IS
'Copies an addresses row into snapshot_addresses, returning the new snapshot id (or NULL if the source is missing/deleted).';
