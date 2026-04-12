# Frontend Refactor Plan — Align with DB Changes

## Context

The DB was refactored with new loan model fields, new enums, and a new booking RPC. The frontend still references old concepts (`share` category, missing loan fields, missing booking statuses). This plan brings the frontend into alignment **without introducing new features** — that's step 2.

**Two distinct phases:**
1. **Phase A — Alignment (this plan)** — Update types, constants, and rendering so the app compiles and doesn't break on existing data. No new UI, no loan creation flow. This is a "make it match the DB" pass.
2. **Phase B — Loan feature implementation** — Add the loan booking flow, return UI, admin management, etc. Separate plan, done after Phase A is tested.

---

## Phase A Scope

### What changes
- Remove `share`/`food` from category type and all constant maps
- Add new booking statuses (`loaned_out`, `returned`, `overdue`) to type + status configs
- Extend types with new fields (`transaction_type`, `deposit_*`, `is_loan`, `loan_*`)
- Default existing rendering paths treat loan items like purchase items (no new UI)

### What does NOT change (deferred to Phase B)
- The offering creation form still only creates `transaction_type: 'purchase'` offerings
- No loan period date pickers in the booking flow
- No return button on booking details
- No admin management panel
- No board redesign with category rows

---

## File Changes

### 1. Type definitions — `src/types/`

#### `src/types/offering.ts`

**`OfferingCategory`:**
```ts
// Before
export type OfferingCategory = 'product' | 'service' | 'share' | 'event';

// After
export type OfferingCategory = 'product' | 'service' | 'event';
```

**`OFFERING_CATEGORIES` constant:** remove the `'share'` entry.

**New type: `TransactionType`**
```ts
export type TransactionType = 'purchase' | 'booking' | 'loan' | 'free';
```

**`Offering` interface:** add
```ts
transaction_type: TransactionType;
requires_deposit: boolean;
deposit_amount: number | null;
```

**`CreateOfferingInput` interface:** add (all optional for now — the form will only create `'purchase'` type)
```ts
transaction_type?: TransactionType;
requires_deposit?: boolean;
deposit_amount?: number | null;
```

**`UpdateOfferingInput` interface:** add the same three fields as optional.

**`AvailabilitySchedule` interface:** add
```ts
loan_duration_days: number;
loan_max_duration_days: number | null;
```

#### `src/types/booking.ts`

**`BookingStatus`:** add three new values
```ts
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'loaned_out'
  | 'returned'
  | 'overdue';
```

**`BookingItemPayload` interface:** add optional loan fields
```ts
is_loan?: boolean;
loan_start_date?: string; // ISO date
loan_due_date?: string;
deposit_amount?: number;
```

**`BookingItemDetail` interface:** add
```ts
is_loan: boolean;
loan_start_date: string | null;
loan_due_date: string | null;
loan_returned_at: string | null;
deposit_amount: number | null;
snapshot_transaction_type: TransactionType | null;
```

**`BookingDetail` interface:** add
```ts
deposit_total: number;
deposit_status: string; // 'none' | 'held' | 'released' | 'forfeited'
```

#### `src/types/supabase.ts`
This file is auto-generated from Supabase. Options:
- **Option A:** Regenerate it via `supabase gen types typescript`. Cleanest.
- **Option B:** Manually edit it to match the DB. Faster but drifts.
- **Option C:** Delete it entirely — if nothing imports from it anymore. It's leftover from before Prisma.

**Decision:** Go with Option C if possible. Grep for imports and remove if unused.

---

### 2. Constants & rendering — category maps

#### `src/app/community/[communityId]/offerings/[offeringId]/index.tsx`
`CATEGORY_COLORS` map — remove `share: ...` entry.

#### `src/app/community/[communityId]/cart.tsx`
`CATEGORY_ICONS` map — remove `share: ...` entry.

#### `src/components/pages/community/board-tab.tsx`
`CATEGORY_TAG_VARIANT` map — remove `share: ...` entry.

---

### 3. Constants & rendering — booking status maps

Two files both have a `STATUS_CONFIG` with label, color, background, icon for each status. Both need to add configs for `loaned_out`, `returned`, `overdue`.

#### `src/app/account/bookings/index.tsx`
Add to `STATUS_CONFIG`:
```ts
loaned_out: { label: 'On Loan', color: '#8B5CF6', bg: 'bg-purple-100' },
returned: { label: 'Returned', color: '#059669', bg: 'bg-emerald-100' },
overdue: { label: 'Overdue', color: '#DC2626', bg: 'bg-red-100' },
```

#### `src/app/booking/[bookingId]/index.tsx`
Add the same three entries to its `STATUS_CONFIG` (with `icon` field, matching the format used in that file).

**Consideration — `STATUS_STEPS` timeline:** The timeline component shows progression through statuses. For now, leave it as the existing purchase flow (`pending → confirmed → in_progress → ready → completed`). Loan status progression (`pending → confirmed → loaned_out → returned → completed`) would need a separate timeline or conditional rendering — deferred to Phase B.

---

### 4. Offering creation form — `src/app/community/[communityId]/offerings/new.tsx`

Remove `share` from the category picker (it's driven by `OFFERING_CATEGORIES`, so it auto-fixes once the constant is updated).

**No new fields for loan creation in this phase** — the form will continue to create `transaction_type: 'purchase'` offerings implicitly. The backend defaults to `'purchase'` so we don't need to send it.

---

### 5. Cart store — `src/lib/stores/cart-store.ts`

Line 8: derives `OfferingCategory` from the Supabase types file.
```ts
type Category = Database['public']['Enums']['offering_category'];
```

If we keep `src/types/supabase.ts`, it needs the `share` removal to propagate. If we delete it, change this line to import from `src/types/offering.ts` directly.

---

### 6. Data migration risk: existing offerings with `share`

The DB migration already converted any `share` / `food` offerings to `product` (via `UPDATE` + enum type change). So there should be no live data referencing the removed values.

**But if any offering uses `transaction_type = 'loan'` after the DB migration** (none do yet, since only defaults), the existing rendering will show them as normal purchase items. That's fine for Phase A — they just won't have any loan-specific UI.

---

## Order of Implementation

1. **Update types** (`src/types/offering.ts`, `src/types/booking.ts`) — everything else depends on these
2. **Handle `src/types/supabase.ts`** — investigate if it's still imported, delete if unused
3. **Update category constants** in the 3 files with `share` references
4. **Update booking status configs** in the 2 files
5. **Update any type imports** that broke (cart-store, etc.)
6. **Verify TypeScript compiles** — `cd nativeCom && npx tsc --noEmit`
7. **Smoke test the app** — navigate to communities, open an offering, view bookings

---

## Files Summary

### Files to modify (7)
- `src/types/offering.ts` — remove `share`, add `TransactionType`, extend `Offering`/`CreateOfferingInput`/`UpdateOfferingInput`/`AvailabilitySchedule`
- `src/types/booking.ts` — add loan statuses, extend `BookingItemPayload`/`BookingItemDetail`/`BookingDetail`
- `src/app/community/[communityId]/offerings/[offeringId]/index.tsx` — remove `share` from `CATEGORY_COLORS`
- `src/app/community/[communityId]/cart.tsx` — remove `share` from `CATEGORY_ICONS`
- `src/components/pages/community/board-tab.tsx` — remove `share` from `CATEGORY_TAG_VARIANT`
- `src/app/account/bookings/index.tsx` — add loan status configs
- `src/app/booking/[bookingId]/index.tsx` — add loan status configs
- `src/lib/stores/cart-store.ts` — fix category import if `supabase.ts` is removed

### Files to investigate
- `src/types/supabase.ts` — likely unused after Prisma migration, candidate for deletion

### Files NOT touched in Phase A
- `src/app/community/[communityId]/offerings/new.tsx` — form stays as-is (creates purchases)
- `src/app/booking/index.tsx` — checkout flow stays single-date
- `src/components/pages/community/board-tab.tsx` — only the category map, no layout changes
- All TanStack Query hooks — no changes needed

---

## Verification

After all changes:
1. `cd nativeCom && npx tsc --noEmit` — zero TypeScript errors
2. Smoke test in app:
   - Open communities tab → load list → open a community
   - Open an offering → view detail
   - Open booking list → view a booking
   - Verify no crashes from missing category or status values
3. Confirm the offering creation form doesn't show `share` in the category picker

---

## Open Questions

1. **`src/types/supabase.ts`** — should we delete it now, or fix it in place? (Recommendation: delete if unused — it's legacy from before Prisma)
2. **`STATUS_STEPS` timeline** — should loan bookings show a different progression? (Deferred to Phase B)
3. **Deposit display** — when a booking has `deposit_total > 0`, should the payment section show it as a line item? (Could add a subtle "Deposit: €X" row in Phase A, or defer to Phase B)
