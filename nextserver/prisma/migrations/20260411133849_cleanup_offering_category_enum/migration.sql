-- ============================================================================
-- Cleanup offering_category enum: remove 'share' and 'food'
-- ============================================================================
-- PostgreSQL doesn't allow dropping enum values directly, so we:
--   1. Migrate any existing rows with deprecated values to 'product'
--   2. Create a new enum with only the desired values
--   3. Change column types to use the new enum
--   4. Drop the old enum and rename the new one
--
-- WARNING: This assumes 'share' and 'food' offerings can be safely
-- reclassified as 'product'. If you need a different mapping (e.g.,
-- 'share' → loans with transaction_type='loan'), update the UPDATE
-- statements below BEFORE running this migration.
-- ============================================================================

-- Step 1: Migrate existing rows to valid values
-- Any offering categorized as 'share' or 'food' becomes a 'product'
UPDATE public.offerings
SET category = 'product'
WHERE category::text IN ('share', 'food');

-- Same for booking_items snapshots (historical data)
UPDATE public.booking_items
SET snapshot_category = 'product'
WHERE snapshot_category::text IN ('share', 'food');

-- Step 2: Create the new enum type
CREATE TYPE public.offering_category_new AS ENUM ('product', 'service', 'event');

-- Step 3: Alter columns to use the new enum
-- The USING clause handles the cast via text. Any values not in the new
-- enum would fail, but Step 1 already migrated them.
ALTER TABLE public.offerings
  ALTER COLUMN category TYPE public.offering_category_new
  USING category::text::public.offering_category_new;

ALTER TABLE public.booking_items
  ALTER COLUMN snapshot_category TYPE public.offering_category_new
  USING snapshot_category::text::public.offering_category_new;

-- Step 4: Drop the old enum and rename the new one
DROP TYPE public.offering_category;
ALTER TYPE public.offering_category_new RENAME TO offering_category;
