-- ==========================================
-- FIX BOOKING RLS RECURSION (42P17)
--
-- Root cause: bookings SELECT policy for providers
-- queries booking_items → booking_items SELECT policy
-- for customers queries bookings → infinite loop.
--
-- Solution: SECURITY DEFINER helpers that bypass RLS.
-- Same pattern as is_community_member(), is_conversation_participant().
--
-- Split into 2 transactions:
--   TX1: Core fix (helpers + bookings + booking_items)
--   TX2: Snapshot/history tables (depend on TX1)
-- ==========================================


-- ==========================================
-- TRANSACTION 1: Core recursion fix
-- These are the critical tables causing 42P17
-- ==========================================
BEGIN;

-- Helper functions (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION is_booking_customer(p_booking_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = p_booking_id
    AND customer_id = get_current_profile_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_booking_provider(p_booking_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM booking_items bi
    JOIN offerings o ON o.id = bi.offering_id
    WHERE bi.booking_id = p_booking_id
    AND o.provider_id = get_current_profile_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- bookings: provider SELECT (was inline join on booking_items → recursion)
DROP POLICY IF EXISTS "Providers can view bookings for their offerings" ON bookings;
CREATE POLICY "Providers can view bookings for their offerings"
  ON bookings FOR SELECT
  USING (is_booking_provider(id));

-- bookings: provider UPDATE (same issue)
DROP POLICY IF EXISTS "Providers can update booking status" ON bookings;
CREATE POLICY "Providers can update booking status"
  ON bookings FOR UPDATE
  USING (is_booking_provider(id))
  WITH CHECK (
    booking_status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')
  );

-- booking_items: customer SELECT (was inline join on bookings → recursion)
DROP POLICY IF EXISTS "Customers can view their booking items" ON booking_items;
CREATE POLICY "Customers can view their booking items"
  ON booking_items FOR SELECT
  USING (is_booking_customer(booking_id));

-- booking_items: customer INSERT (same issue)
DROP POLICY IF EXISTS "Customers can create booking items with their bookings" ON booking_items;
CREATE POLICY "Customers can create booking items with their bookings"
  ON booking_items FOR INSERT
  WITH CHECK (is_booking_customer(booking_id));

COMMIT;


-- ==========================================
-- TRANSACTION 2: Snapshot & history tables
-- All use the helpers created in TX1.
-- Policy names match schema.sql exactly.
-- ==========================================
BEGIN;

-- booking_status_history
DROP POLICY IF EXISTS "Customers can view own booking history" ON booking_status_history;
CREATE POLICY "Customers can view own booking history"
  ON booking_status_history FOR SELECT
  USING (is_booking_customer(booking_id));

DROP POLICY IF EXISTS "Providers can view history for their bookings" ON booking_status_history;
CREATE POLICY "Providers can view history for their bookings"
  ON booking_status_history FOR SELECT
  USING (is_booking_provider(booking_id));

-- booking_customer_snapshots
DROP POLICY IF EXISTS "Customers can view own booking snapshots" ON booking_customer_snapshots;
CREATE POLICY "Customers can view own booking snapshots"
  ON booking_customer_snapshots FOR SELECT
  USING (is_booking_customer(booking_id));

DROP POLICY IF EXISTS "Providers can view customer snapshots for their orders" ON booking_customer_snapshots;
CREATE POLICY "Providers can view customer snapshots for their orders"
  ON booking_customer_snapshots FOR SELECT
  USING (is_booking_provider(booking_id));

-- booking_delivery_snapshots
DROP POLICY IF EXISTS "Customers can view own delivery snapshots" ON booking_delivery_snapshots;
CREATE POLICY "Customers can view own delivery snapshots"
  ON booking_delivery_snapshots FOR SELECT
  USING (is_booking_customer(booking_id));

DROP POLICY IF EXISTS "Providers can view delivery snapshots for their orders" ON booking_delivery_snapshots;
CREATE POLICY "Providers can view delivery snapshots for their orders"
  ON booking_delivery_snapshots FOR SELECT
  USING (is_booking_provider(booking_id));

-- booking_community_snapshots
DROP POLICY IF EXISTS "Customers can view own community snapshots" ON booking_community_snapshots;
CREATE POLICY "Customers can view own community snapshots"
  ON booking_community_snapshots FOR SELECT
  USING (is_booking_customer(booking_id));

DROP POLICY IF EXISTS "Providers can view community snapshots for their orders" ON booking_community_snapshots;
CREATE POLICY "Providers can view community snapshots for their orders"
  ON booking_community_snapshots FOR SELECT
  USING (is_booking_provider(booking_id));

-- booking_provider_snapshots
DROP POLICY IF EXISTS "Customers can view provider snapshots for their bookings" ON booking_provider_snapshots;
CREATE POLICY "Customers can view provider snapshots for their bookings"
  ON booking_provider_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      WHERE bi.id = booking_provider_snapshots.booking_item_id
      AND is_booking_customer(bi.booking_id)
    )
  );

-- booking_schedule_snapshots
DROP POLICY IF EXISTS "Customers can view schedule snapshots for their bookings" ON booking_schedule_snapshots;
CREATE POLICY "Customers can view schedule snapshots for their bookings"
  ON booking_schedule_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_items bi
      WHERE bi.id = booking_schedule_snapshots.booking_item_id
      AND is_booking_customer(bi.booking_id)
    )
  );

-- snapshot_addresses
DROP POLICY IF EXISTS "Users can view snapshot addresses for their bookings" ON snapshot_addresses;
CREATE POLICY "Users can view snapshot addresses for their bookings"
  ON snapshot_addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_delivery_snapshots bds
      WHERE bds.snapshot_address_id = snapshot_addresses.id
      AND is_booking_customer(bds.booking_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM booking_provider_snapshots bps
      JOIN booking_items bi ON bi.id = bps.booking_item_id
      WHERE bps.snapshot_address_id = snapshot_addresses.id
      AND is_booking_provider(bi.booking_id)
    )
  );

COMMIT;


-- ==========================================
-- CLEANUP: Remove orphan policies from failed
-- previous migration attempt (004 v1 used
-- wrong names that don't match schema.sql)
-- ==========================================
DROP POLICY IF EXISTS "Customers can view community snapshots for their bookings" ON booking_community_snapshots;
DROP POLICY IF EXISTS "Customers can view delivery snapshots for their bookings" ON booking_delivery_snapshots;
