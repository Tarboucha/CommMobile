# Calendar — Bookings Integration Plan

## Context

The calendar tab exists with a full UI (month nav, week strip, date selection, render prop) but shows "No Events" for every date. It needs to display the user's bookings — both as customer and provider.

## What the user sees

```
┌──────────────────────────────────────┐
│  ◀  April 2026  ▶    3 today        │
├──────────────────────────────────────┤
│  Mo  Tu  We  Th  Fr  Sa  Su         │
│  7   8   9  10  11  12 [13]         │
│       •       •   •   ••             │ ← dots = bookings on that date
├──────────────────────────────────────┤
│                                      │
│  🟢 Haircut — 10:00                 │ ← service (as customer)
│     with Alice M.   Confirmed        │
│                                      │
│  🟢 Haircut — 11:00                 │ ← service (as provider)
│     Bob K.          Pending          │
│                                      │
│  🟣 Drill Loan                      │ ← loan (as provider)
│     Carol S.    Due back Apr 17      │
│                                      │
│  🟡 Pottery Workshop — 14:00        │ ← event (as customer)
│     RSVP'd          Confirmed        │
│                                      │
└──────────────────────────────────────┘
```

## Data needed

For each date with bookings, we need:
- Booking ID (for navigation)
- Offering title (snapshot)
- Category (service/event/loan/product)
- Status (pending/confirmed/etc.)
- Time (instance_start_time if service, or schedule start_time for events)
- Role (customer or provider)
- The other party's name (provider name if customer, customer name if provider)
- Loan due date (for loans)

## Backend

### Option A: Reuse `listBookings` with date filtering

Add optional `from_date` and `to_date` query params to `GET /api/v1/bookings`:

```
GET /api/v1/bookings?from_date=2026-04-01&to_date=2026-04-30
```

Filter by: `booking_items.instance_date` (services/events), `booking_items.loan_start_date` through `loan_due_date` (loans), or `bookings.created_at` (products without a date).

**Pros**: No new endpoint. Reuses existing query + types.
**Cons**: `listBookings` fetches all fields — heavier than needed for calendar dots.

### Option B: New lightweight endpoint `GET /api/v1/bookings/calendar`

```
GET /api/v1/bookings/calendar?month=2026-04
```

Returns a compact shape optimized for calendar display:
```json
{
  "dates": {
    "2026-04-13": [
      {
        "booking_id": "...",
        "title": "Haircut",
        "category": "service",
        "status": "confirmed",
        "time": "10:00",
        "role": "customer",
        "other_party_name": "Alice M."
      }
    ],
    "2026-04-14": [ ... ]
  },
  "event_counts": {
    "2026-04-13": 3,
    "2026-04-14": 1
  }
}
```

**Pros**: Minimal payload, pre-grouped by date, includes event_counts for dots.
**Cons**: New endpoint + service method.

### Recommendation: Option A for now

Reuse `listBookings` with date filtering. The calendar queries once per month — the payload size is acceptable. The frontend groups by date client-side (same pattern as the provider grouped view).

### Changes to `listBookings`

Add optional `fromDate` / `toDate` parameters:

```typescript
export async function listBookings(userId: string, role?: string, fromDate?: string, toDate?: string) {
  // ... existing where clause ...

  if (fromDate || toDate) {
    where.booking_items = {
      some: {
        OR: [
          // Services/events: instance_date in range
          {
            instance_date: {
              ...(fromDate && { gte: new Date(fromDate) }),
              ...(toDate && { lte: new Date(toDate) }),
            },
          },
          // Loans: overlaps with range (start <= toDate AND due >= fromDate)
          {
            is_loan: true,
            loan_start_date: { ...(toDate && { lte: new Date(toDate) }) },
            loan_due_date: { ...(fromDate && { gte: new Date(fromDate) }) },
          },
        ],
      },
    };
  }
}
```

### API change

```
GET /api/v1/bookings?from_date=2026-04-01&to_date=2026-04-30
```

Add to `bookingListQuerySchema` in validations:
```typescript
from_date: z.string().regex(dateRegex).optional(),
to_date: z.string().regex(dateRegex).optional(),
```

---

## Frontend

### New hook: `useCalendarBookings(month: Date)`

```typescript
export function useCalendarBookings(month: Date) {
  const user = useAuthStore((s) => s.user);
  const fromDate = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
  const toDate = lastDayOfMonth(month);

  return useQuery({
    queryKey: [...queryKeys.bookings.all, 'calendar', fromDate],
    queryFn: () => getMyBookings(undefined, fromDate, toDate),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}
```

### Client-side grouping

```typescript
function groupByDate(bookings: BookingListItem[]): Map<string, BookingListItem[]> {
  const map = new Map<string, BookingListItem[]>();
  for (const b of bookings) {
    const item = b.booking_items[0];
    // Determine which date(s) this booking occupies
    const dates = getBookingDates(item); // instance_date, or loan_start..due range
    for (const date of dates) {
      const list = map.get(date) || [];
      list.push(b);
      map.set(date, list);
    }
  }
  return map;
}
```

### Event counts (dots)

Derive from grouped data:
```typescript
const eventCounts = useMemo(() => {
  const counts = new Map<string, number>();
  for (const [date, bookings] of grouped) {
    counts.set(date, bookings.length);
  }
  return counts;
}, [grouped]);
```

### Day content (render prop)

New component: `CalendarDayBookings` — renders the list of bookings for a selected date.

Each booking row shows:
- Category icon (colored)
- Title + time (if service/event)
- Other party name
- Status badge
- Tap → navigate to booking detail

### Calendar screen update

```typescript
export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: bookings } = useCalendarBookings(currentMonth);

  const grouped = useMemo(() => groupByDate(bookings ?? []), [bookings]);
  const eventCounts = useMemo(() => /* derive counts */, [grouped]);
  const dayBookings = grouped.get(selectedDate) ?? [];

  return (
    <Calendar
      selectedDate={selectedDate}
      onDateSelect={setSelectedDate}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      eventCounts={eventCounts}
      renderDayContent={() => (
        dayBookings.length > 0
          ? <CalendarDayBookings bookings={dayBookings} userId={userId} />
          : <EmptyDay />
      )}
    />
  );
}
```

---

## Files

### Backend
- Modify: `nextserver/src/lib/services/booking-service.ts` — add date params to `listBookings`
- Modify: `nextserver/src/app/api/v1/bookings/route.ts` — parse `from_date` / `to_date` query params
- Modify: `nextserver/src/lib/validations/booking.ts` — add to query schema (or validate inline)

### Frontend
- Modify: `nativeCom/src/lib/api/bookings/index.ts` — add date params to `getMyBookings`
- New: `nativeCom/src/hooks/queries/use-calendar-bookings.ts`
- New: `nativeCom/src/components/pages/calendar/calendar-day-bookings.tsx`
- Modify: `nativeCom/src/app/(tabs)/calendar.tsx` — wire everything together

### Types
- Modify: `nativeCom/src/types/booking.ts` — `BookingListItem` already has all needed fields (instance_date, instance_start_time, snapshot_category, is_loan, loan_due_date, offering_id, booking_customer_snapshots)

---

## Edge cases

1. **Loans span multiple days**: A loan from Apr 12–17 should show a dot on every day in that range, and appear in the day list for each.
2. **Products without dates**: Products have no `instance_date`. Show them on their `created_at` date as "Order placed."
3. **Cancelled bookings**: Include but show greyed out / struck through. Users need to see their full history.
4. **Month boundaries**: A loan starting Mar 30 and ending Apr 5 should appear in both March and April calendar views.
5. **Performance**: One query per month. With staleTime of 2 min, navigating back and forth between months uses cache.
