# Phase 2b — Loan & Booking Flow Refactor

## Goal

Two combined refactors:
1. **Reshape the cart/booking model** — provider-scoped cart for products, direct booking for loans/services/events
2. **Add the loan booking flow** — date picker, deposit handling, booking creation with loan fields

The DB and RPC already support everything needed (multi-day slot reservation, deposit tracking, return flow). This plan focuses on the **frontend booking flow**.

---

## The new transaction model

| Offering type | Booking flow | Why |
|---|---|---|
| **Product (purchase)** | **Cart** → review → place booking | Multi-item from same provider is a real use case (e.g., baker selling cookies + cake) |
| **Product (loan)** | **Direct booking** with date picker | Each loan has its own period, deposit, and return — doesn't compose with other items |
| **Service (booking)** | **Direct booking** with time slot | Time-based, one slot at a time |
| **Event** | **Direct booking** (RSVP-style) | One event ticket per booking |

### Cart rules (provider-scoped)

The cart is **scoped to a single provider** within a community. This eliminates the current "split-at-checkout" UX lie where one cart pretends to be one transaction but actually creates multiple bookings.

- Adding a product from a different provider → "Replace your current order with this item?" prompt
- Switching communities → cart auto-clears (existing behavior)
- Cart screen shows "Order from [Provider Name]" — no more "this will create N bookings" warning
- One cart = one booking, always

### Direct booking flow (loans/services/events)

- "Book Now" button on the offering detail screen
- Opens a sheet/modal with the booking details (date, deposit, payment method, etc.)
- Confirms → creates a booking immediately
- No cart involved

---

## Current State

### What works
- Loan offerings can be **created** (offering form has loan fields, deposit, schedule loan duration)
- Cart store has multi-item, multi-provider, split-at-checkout logic
- Booking review screen takes the cart and creates bookings

### What needs to change
1. **Cart store** — scope to single provider, drop split-at-checkout, drop loan fields (loans bypass cart)
2. **Offering detail screen** — show different action depending on transaction type:
   - Product/purchase → "Add to Order" (cart)
   - Product/loan → "Book Now" (direct, opens loan booking sheet)
   - Service/event → "Book Now" (direct, opens service/event booking sheet)
3. **Booking review screen** — simplify (no split logic, single provider)
4. **New: Loan booking sheet** — start date picker + computed return date + deposit display + confirmation
5. **New: Direct booking handler** — creates a booking with one item, bypassing the cart

---

## Design decisions

### 1. The loan booking sheet (new)

When the user taps "Book Now" on a loan offering, a modal/sheet opens with:

```
┌─────────────────────────────────┐
│  Borrow: Drill                   │
│                                  │
│  Pickup date                     │
│  ┌─────────────────────────────┐ │
│  │ Mon, Apr 14                 │ │ ← date picker
│  └─────────────────────────────┘ │
│                                  │
│  Return by: Sun, Apr 20          │ ← computed from start + duration
│  Loan period: 7 days             │
│                                  │
│  Rental fee:        €5.00        │
│  Security deposit:  €50.00       │ ← if requires_deposit
│  ───────────────────────         │
│  Total:             €55.00       │
│                                  │
│  Pickup at: [address]            │
│  Payment: [Cash / External]      │
│                                  │
│  [Confirm Booking]               │
└─────────────────────────────────┘
```

**Fields needed:**
- Pickup date (only adjustable field)
- Payment method (cash/external)
- Special instructions (optional textarea)
- Contact phone (optional)
- Delivery address (only if `fulfillment_method === 'delivery'`)

### 2. The loan period

The borrower picks a **start date only**. The end date is automatically computed as `start_date + loan_duration_days - 1` and displayed read-only.

`loan_max_duration_days` stays in the schema for a future "Extend loan" feature (provider-side, after booking is active).

### 3. The cart becomes provider-scoped

Update `BookingCartItem` and the cart store:
- Add `providerId` enforcement: adding an item from a different provider clears or prompts
- Remove `is_loan`, `loan_start_date`, `loan_due_date`, `deposit_amount` from cart (loans bypass cart)
- Cart can only contain products with `transaction_type === 'purchase'`
- Cart screen shows the provider name prominently
- Booking review removes split-by-provider logic (cart already has only one provider)

### 4. Direct booking helper

Create a new module that handles direct (non-cart) booking creation. Used by:
- Loan booking sheet
- Service booking sheet (Phase 2c+)
- Event booking sheet (Phase 2c+)

```ts
// src/lib/direct-booking.ts (or similar)
export async function createDirectBooking(params: {
  offering: Offering;
  scheduleId: string | null;
  instanceDate: string | null;
  loanStartDate?: string;
  loanDueDate?: string;
  quantity: number;
  paymentMethod: 'cash' | 'external';
  deliveryAddressId?: string | null;
  specialInstructions?: string;
  contactPhone?: string;
}): Promise<BookingResponse>;
```

This calls `createBooking` (existing API) with a single-item payload — no cart logic involved.

---

## Implementation Plan

### Phase 2b.1 — Cart simplification (provider-scoped, products only)

The cart becomes a **product-purchase-only** structure. Three constraints enforced:
- One **community** at a time (already enforced)
- One **provider** at a time (new)
- Only **products** with `transaction_type === 'purchase'` (new)

1. **Update cart store** ([cart-store.ts](nativeCom/src/lib/stores/cart-store.ts))
   - Add `providerId` to top-level state (track current provider)
   - **Remove** loan-related fields from `BookingCartItem` if any exist
   - **Type-level guarantee**: `BookingCartItem.offeringCategory` becomes `'product'` (not the full enum) — the type itself enforces "products only"
   - On `addItem`:
     - If item's category is not `'product'` → throw an error (shouldn't happen at runtime since the offering detail screen routes correctly, but the guard catches bugs)
     - If `state.providerId` differs from new item's `providerId` → prompt user (or clear and replace)
   - Drop `removeItems` helper (no longer needed without split)
   - Drop the multi-provider split logic from `getTotalAmount`/`getItemCount`

2. **Update offering detail screen**
   - **Decision tree at the top of the screen**:
     - `category === 'product' && transaction_type === 'purchase'` → "Add to Order" (cart flow)
     - `category === 'product' && transaction_type === 'loan'` → "Borrow" (direct loan sheet)
     - `category === 'service'` → "Book Time" (direct service sheet, basic)
     - `category === 'event'` → "RSVP" (direct event sheet, basic)
   - The cart-related state and quantity controls are only rendered for the first case
   - For all other cases, the screen shows a single "Book Now" button that opens the appropriate sheet

3. **Simplify booking review screen** ([booking/index.tsx](nativeCom/src/app/booking/index.tsx))
   - Remove `groupByProvider` logic
   - Remove "this will create N bookings" warning
   - Remove `Promise.allSettled` split — single provider = single booking
   - Show provider name at top instead of grouping
   - Submit creates one booking via the existing `createBooking` API
   - This screen is now **only used for product purchases** — the direct booking sheets bypass it entirely

4. **Update cart screen** ([community/[communityId]/cart.tsx](nativeCom/src/app/community/[communityId]/cart.tsx))
   - Show provider name in header (and possibly community name)
   - Rename screen title from "Cart" to "Your Order" (optional but reduces cart confusion)
   - Remove any references to multi-provider scenarios

5. **Update cart store consumers** — anywhere that reads the cart needs to know it's products-only:
   - Cart icon badge in the navigation (already correct, just shows a count)
   - `clearCart` calls in community detail (still valid)

### Phase 2b.2 — Direct booking infrastructure

1. **Create direct-booking helper** (`src/lib/direct-booking.ts` or similar)
   - Wraps `createBooking` for single-item bookings
   - Handles loan fields, deposit, etc.
   - Returns the created booking

2. **Create reusable booking sheet component** (`src/components/booking/direct-booking-sheet.tsx`)
   - Bottom sheet or modal
   - Common fields: payment method, special instructions, contact phone
   - Conditional fields based on transaction type
   - Submit button → calls direct-booking helper → navigates to success screen

### Phase 2b.3 — Loan booking sheet

1. **Create loan booking sheet variant** (`src/components/booking/loan-booking-sheet.tsx`)
   - Wraps the direct booking sheet with loan-specific fields
   - Start date picker
   - Computed return date display
   - Deposit display (if `requires_deposit`)
   - Confirmation calls direct-booking helper with `is_loan: true`

2. **Wire it into the offering detail screen**
   - When a loan offering is opened → "Book Now" button opens this sheet

### Phase 2b.4 — Service & event booking (basic)

For now, services and events can still use **the same `createBooking` API** with a simpler sheet (no loan fields). This keeps the door open for later refinements without blocking Phase 2b.

The minimum viable: a simple sheet with date/time picker (for services) or RSVP confirmation (for events). Can be deferred or basic.

---

## Files affected

### Cart-related (refactor)
- `src/lib/stores/cart-store.ts` — provider scoping, drop multi-provider logic
- `src/app/booking/index.tsx` — single-provider, no split, simpler
- `src/app/community/[communityId]/cart.tsx` — show provider name

### Offering detail (route by transaction type)
- `src/app/community/[communityId]/offerings/[offeringId]/index.tsx` — different action button per type

### New direct booking infrastructure
- `src/lib/direct-booking.ts` — helper function (or a hook)
- `src/components/booking/direct-booking-sheet.tsx` — reusable sheet
- `src/components/booking/loan-booking-sheet.tsx` — loan variant
- (later) `src/components/booking/service-booking-sheet.tsx`
- (later) `src/components/booking/event-booking-sheet.tsx`

---

## Validation & edge cases

1. **User adds product from provider A, then tries to add from provider B** → prompt: "Replace your current order with this item from [Provider B]?"
2. **Cart has items, user navigates to a loan offering and books directly** → cart stays untouched (different flow), but maybe surface a hint that they have an existing cart
3. **Loan with delivery fulfillment** → still need to ask for delivery address (rare but possible)
4. **Pickup date in the past** → minimum is today
5. **Pickup date with no availability** → backend rejects with clear error from the RPC
6. **No schedule on a loan offering** → shouldn't happen (form enforces it), but show error if it does

---

## Out of scope (Phase 2c+)

- Return flow (mark as returned, release slots)
- Overdue detection
- Calendar view of available dates
- Real-time availability check via `get_available_slots`
- Loan extensions
- Service-specific time slot picker (basic version OK for Phase 2b)
- Event-specific RSVP UI (basic version OK for Phase 2b)
- Multi-deposit support (multiple deposits across items)

---

## Open questions

1. **Should the cart be cleared automatically when adding from a different provider, or should we always prompt?** Recommendation: prompt with "Replace order?" so the user doesn't accidentally lose items.
2. **Should pickup time be configurable, or just date?** Recommendation: date only for v1. The schedule's `start_time` / `end_time` defines the daily pickup window.
3. **What if the offering's price is free (rental fee = 0) and no deposit?** The booking still goes through, just with `total_amount = 0`. The user gets a confirmation but no payment needed.
