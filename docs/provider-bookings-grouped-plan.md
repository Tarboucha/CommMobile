# Provider Bookings — Grouped by Offering

## Problem

The provider's "As Provider" tab shows a flat list of individual bookings. A barber with 15 appointments sees 15 separate cards — no way to get an overview of their day or see which offerings are active.

## Design

### Customer view (unchanged)
Flat list of their bookings. Each booking = one card. Works fine because customers have few bookings.

### Provider view — grouped by offering

```
┌────────────────────────────────────────────────────┐
│ ✂️ Haircut                              5 bookings │
│ 🟢 2 confirmed  🟡 1 pending  ✅ 2 completed      │
│ Today: 10:00, 11:00, 14:30  Tomorrow: 09:00       │
├────────────────────────────────────────────────────┤
│  10:00 — Alice M.                      Confirmed  │
│  11:00 — Bob K.                        Pending    │
│  14:30 — Carol S.                      Confirmed  │
│  [View all 5 bookings →]                          │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🔧 Drill (Loan)                        1 booking  │
│ 🟣 1 on loan                                      │
│ Due back Apr 17                                    │
├────────────────────────────────────────────────────┤
│  David L.                  On Loan — due in 3 days │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🎨 Pottery Workshop                    12 bookings │
│ 🟢 10 confirmed  🟡 2 pending                     │
│ Apr 19, 14:00–16:00                                │
├────────────────────────────────────────────────────┤
│  [View all 12 bookings →]                          │
└────────────────────────────────────────────────────┘
```

### Card structure

**Group header:**
- Offering title + image
- Category badge (same as detail screen: Appointment/Event/Loan/Order)
- Total booking count
- Status summary: count per active status (e.g., "2 confirmed, 1 pending")

**Expanded bookings (show top 3, collapse rest):**
- Per-booking row: customer name + time slot + status badge
- For services: show time ("10:00")
- For loans: show due date or "Returned"
- For events: show attendee count
- For products: show item count + delivery method

**"View all" link:** navigates to a filtered list showing all bookings for that offering.

---

## Data Model

### Current list query returns:
```typescript
{
  id, booking_number, booking_status, customer_id, provider_id,
  total_amount, currency_code, created_at,
  booking_items: [{ id, snapshot_title, snapshot_image_url, snapshot_category, quantity,
                    is_loan, instance_date, instance_start_time, loan_due_date, loan_returned_at }],
  booking_community_snapshots: { snapshot_community_name }
}
```

### What's needed additionally:
- `offering_id` on booking items (already in DB, just not selected in list query)
- Customer name — either from `booking_customer_snapshots` (add to include) or a separate query

### Grouping approach:
1. Fetch flat list as today (single query, no backend change needed)
2. Group client-side by `booking_items[0].offering_id` (direct bookings are single-item, cart bookings share a provider but may mix offerings — handle gracefully)
3. Sort groups by most recent booking within each group

**Backend option (better for scale):** Add a `GET /api/v1/bookings/provider-summary` endpoint that returns pre-grouped data:
```json
{
  "offerings": [
    {
      "offering_id": "...",
      "offering_title": "Haircut",
      "offering_image_url": "...",
      "category": "service",
      "total_bookings": 5,
      "status_counts": { "pending": 1, "confirmed": 2, "completed": 2 },
      "upcoming": [
        { "booking_id": "...", "customer_name": "Alice M.", "instance_date": "2026-04-14", "instance_start_time": "10:00", "status": "confirmed" },
        { "booking_id": "...", "customer_name": "Bob K.", "instance_date": "2026-04-14", "instance_start_time": "11:00", "status": "pending" }
      ]
    }
  ]
}
```

This approach is more efficient (one query with GROUP BY vs fetching all bookings) and gives the server control over what "upcoming" means.

---

## Implementation

### Option A: Client-side grouping (simpler, faster to build)

No backend changes. Group the existing flat list in the component:

```typescript
const grouped = useMemo(() => {
  if (!bookings) return [];
  const map = new Map<string, { offering: OfferingInfo; bookings: BookingListItem[] }>();
  for (const b of bookings) {
    const item = b.booking_items[0];
    const key = item?.offering_id ?? b.id;
    if (!map.has(key)) {
      map.set(key, {
        offering: { id: key, title: item?.snapshot_title, image: item?.snapshot_image_url, category: getListCategory(b.booking_items) },
        bookings: [],
      });
    }
    map.get(key)!.bookings.push(b);
  }
  return [...map.values()].sort((a, b) => /* most recent first */);
}, [bookings]);
```

**Pros:** No backend change, fast to ship.
**Cons:** Requires fetching ALL bookings upfront (no pagination), customer name not available in current list data.

### Option B: Dedicated backend endpoint (more scalable)

New `GET /api/v1/bookings/provider-summary` with SQL-level grouping.

**Pros:** Efficient for providers with many bookings, includes customer names, paginated.
**Cons:** New endpoint + service method.

### Recommendation

**Start with Option A** (client-side grouping) — it works with the existing data and can be built in ~1 hour. Add `offering_id` and `customer_snapshot` to the list query.

**Move to Option B** when a provider has 50+ bookings and the flat fetch becomes slow.

---

## Changes needed

### Backend (minimal for Option A)
- Add `offering_id` to booking items select in `listBookings`
- Add customer snapshot (display_name) to list include

### Frontend
- New component: `OfferingBookingGroup` — renders the grouped card
- New component: `BookingRow` — compact single-booking row within a group
- Update `MyBookingsScreen` — detect provider tab → render grouped, customer tab → render flat
- `SectionList` instead of `FlatList` for the provider view

### Files
- Modify: `nextserver/src/lib/services/booking-service.ts` — expand list query
- Modify: `nativeCom/src/types/booking.ts` — add fields to BookingListItem
- Modify: `nativeCom/src/app/account/bookings/index.tsx` — grouped provider view
- New: `nativeCom/src/components/pages/bookings/offering-booking-group.tsx`
- New: `nativeCom/src/components/pages/bookings/booking-row.tsx`
