# Time-Slotted Booking Plan

## Context

Service bookings are currently date-based — a customer picks a day but not a time within that day. A barber available 09:00–17:00 with 45-minute appointments can only accept one booking per day because the system tracks a single `slots_booked` counter per `(schedule_id, instance_date)`. This plan adds sub-day time-slot granularity for service offerings while keeping everything else (loans, events, products) date-based.

**Design rule**: `slot_duration_minutes IS NULL` → date-based (current behavior). `slot_duration_minutes IS NOT NULL` → time-slotted. Fully backward-compatible.

---

## Phase 1: Database Migration

Single migration file: `add_time_slotted_bookings`

### 1a. Schema changes

**`availability_schedules`** — new column:
```sql
ALTER TABLE availability_schedules ADD COLUMN slot_duration_minutes INT;
ALTER TABLE availability_schedules ADD CONSTRAINT chk_slot_duration_positive
  CHECK (slot_duration_minutes IS NULL OR slot_duration_minutes > 0);
```

**`schedule_instances`** — extend PK to include time:
```sql
ALTER TABLE schedule_instances ADD COLUMN slot_start_time TIME NOT NULL DEFAULT '00:00:00';
ALTER TABLE schedule_instances DROP CONSTRAINT schedule_instances_pkey;
ALTER TABLE schedule_instances ADD PRIMARY KEY (schedule_id, instance_date, slot_start_time);
```
Date-based schedules use sentinel `'00:00:00'` → one row per day (no behavior change). Time-slotted → one row per slot per day.

**`schedule_exceptions`** — duration override:
```sql
ALTER TABLE schedule_exceptions ADD COLUMN override_slot_duration_minutes INT;
ALTER TABLE schedule_exceptions ADD CONSTRAINT chk_exception_slot_duration_positive
  CHECK (override_slot_duration_minutes IS NULL OR override_slot_duration_minutes > 0);
```
Allows the provider to change slot length for a specific date (e.g., 30-min express sessions instead of the usual 45-min). When set, `get_time_slots_for_date` uses it instead of the schedule's default. When NULL, falls back to the schedule's `slot_duration_minutes`.

**`booking_items`** — new time columns:
```sql
ALTER TABLE booking_items ADD COLUMN instance_start_time TIME;
ALTER TABLE booking_items ADD COLUMN instance_end_time TIME;
```

**`booking_schedule_snapshots`** — capture duration:
```sql
ALTER TABLE booking_schedule_snapshots ADD COLUMN snapshot_slot_duration_minutes INT;
ALTER TABLE booking_schedule_snapshots ADD COLUMN exception_override_slot_duration_minutes INT;
```

### 1b. New RPC: `get_time_slots_for_date(schedule_id, date)`

Returns `TABLE(slot_start_time, slot_end_time, slots_available, slots_booked, is_available)`.

Logic:
1. Load schedule (bail if inactive or `slot_duration_minutes IS NULL`)
2. Load exception for that date (if any): apply override for time window, capacity, cancellation
3. Compute effective duration: `COALESCE(exception.override_slot_duration_minutes, schedule.slot_duration_minutes)`
4. Generate slots by stepping `effective_start` forward by `effective_duration` until `start + duration > effective_end`
5. For each slot, look up `schedule_instances` to get current `slots_booked`
6. Return with `is_available = (booked < capacity)`

### 1c. Updated RPCs

**`reserve_slots_for_date`** — new 4-param overload `(schedule_id, date, quantity, slot_start_time)`:
- Same logic as existing 3-param version but upserts with the specific `slot_start_time` instead of sentinel

**Existing 3-param `reserve_slots_for_date`** — add `AND slot_start_time = '00:00:00'` to WHERE clauses (explicit sentinel match since PK now has 3 columns)

**`release_slots_for_date`** — same pattern: add sentinel filter to existing, add 4-param overload for time-slotted

**`get_booked_slots`** — add `AND slot_start_time = '00:00:00'` to existing function (date-based only). The time-slotted query happens inline in `get_time_slots_for_date`.

**`reserve_item_slots`** — branch on `instance_start_time` in the JSONB payload:
```
IF v_slot_start_time IS NOT NULL THEN
  reserve_slots_for_date(schedule_id, date, qty, slot_start_time)  -- 4-param
ELSE
  reserve_slots_for_date(schedule_id, date, qty)  -- 3-param sentinel
```

**`insert_booking_item`** — add `instance_start_time`, `instance_end_time` to INSERT

**`create_schedule_snapshot`** — capture `snapshot_slot_duration_minutes` from schedule + `exception_override_slot_duration_minutes` from exception (if any)

### 1d. Prisma schema update

Update models: `availability_schedules`, `schedule_instances` (`@@id` gains `slot_start_time`), `booking_items`, `booking_schedule_snapshots`

### Critical files
- New migration: `nextserver/prisma/migrations/<timestamp>_add_time_slotted_bookings/migration.sql`
- `nextserver/prisma/schema.prisma`

---

## Phase 2: Backend API

### 2a. New endpoint: `GET /api/offerings/[offeringId]/schedules/[scheduleId]/time-slots?date=YYYY-MM-DD`

Calls `get_time_slots_for_date` RPC via `prisma.$queryRaw`. Returns:
```json
{
  "schedule_id": "...",
  "date": "2026-04-15",
  "slot_duration_minutes": 45,
  "slots": [
    { "start_time": "09:00", "end_time": "09:45", "slots_available": 1, "slots_booked": 0, "is_available": true },
    { "start_time": "09:45", "end_time": "10:30", "slots_available": 1, "slots_booked": 0, "is_available": true }
  ]
}
```

### 2b. Validation schema updates

`nextserver/src/lib/validations/offering.ts`:
- Add `slot_duration_minutes: z.number().int().min(15).max(480).optional().nullable()` to `createScheduleSchema` / `updateScheduleSchema`

`nextserver/src/lib/validations/booking.ts`:
- Add `instance_start_time` / `instance_end_time` (HH:MM, optional) to `bookingItemSchema`
- Refinement: if one is set, both must be set

### 2c. Schedule routes

`nextserver/src/app/api/offerings/[offeringId]/schedules/route.ts` (POST) and `[scheduleId]/route.ts` (PATCH):
- Persist `slot_duration_minutes`

### 2d. Booking creation route

`nextserver/src/app/api/bookings/route.ts`:
- Pass `instance_start_time` / `instance_end_time` through `itemsForRpc` from validated input

### Critical files
- New: `nextserver/src/app/api/offerings/[offeringId]/schedules/[scheduleId]/time-slots/route.ts`
- Modify: `nextserver/src/lib/validations/offering.ts`
- Modify: `nextserver/src/lib/validations/booking.ts`
- Modify: `nextserver/src/app/api/offerings/[offeringId]/schedules/route.ts`
- Modify: `nextserver/src/app/api/offerings/[offeringId]/schedules/[scheduleId]/route.ts`
- Modify: `nextserver/src/app/api/bookings/route.ts`

---

## Phase 3: Frontend Types

`nativeCom/src/types/offering.ts`:
- `AvailabilitySchedule`: add `slot_duration_minutes: number | null`
- `CreateScheduleInput`: add `slot_duration_minutes?: number | null`
- New `TimeSlot` interface: `{ start_time, end_time, slots_available, slots_booked, is_available }`

`nativeCom/src/types/booking.ts`:
- `BookingItemPayload`: add `instance_start_time?: string | null`, `instance_end_time?: string | null`
- `BookingItemDetail`: add `instance_start_time`, `instance_end_time`
- `ScheduleSnapshot`: add `snapshot_slot_duration_minutes: number | null`

`nativeCom/src/lib/direct-booking.ts`:
- `DirectBookingParams`: add `instanceStartTime?`, `instanceEndTime?`
- `buildDirectBookingPayload`: pass them through to the item payload

---

## Phase 4: Frontend API + Hooks

**New API function** in `nativeCom/src/lib/api/offerings/index.ts`:
```ts
getTimeSlots(offeringId, scheduleId, date) → TimeSlotResponse
```

**New query key** in `nativeCom/src/lib/query-keys.ts`:
```ts
offerings.timeSlots(scheduleId, date)
```

**New hook** `nativeCom/src/hooks/queries/use-time-slots.ts`:
```ts
useTimeSlots(offeringId, scheduleId, date) — enabled when date is set
```

---

## Phase 5: Frontend UI

### 5a. Offering form — Slot Duration field

`nativeCom/src/components/pages/offerings/form/form-state.ts`:
- Add `slotDurationMinutes: string` to state (empty = no duration)

`nativeCom/src/components/pages/offerings/form/schedule-section.tsx`:
- Show duration picker only when `category === 'service'`
- Options: "Full window (no slots)", 15, 30, 45, 60, 90, 120 min

`nativeCom/src/components/pages/offerings/form/submit-handler.ts`:
- Pass `slot_duration_minutes` to schedule creation

### 5b. Time slot picker component

New `nativeCom/src/components/booking/time-slot-list.tsx`:
- Takes `offeringId, scheduleId, date, selectedSlot, onSelectSlot`
- Calls `useTimeSlots` hook
- Renders scrollable list of slot cards with time + availability badge
- Loading/error states

### 5c. ScheduledBookingSheet integration

`nativeCom/src/components/booking/scheduled-booking-sheet.tsx`:
- Check `schedule.slot_duration_minutes`
- If null → existing date-only UI
- If set → show `TimeSlotList` after date picker, track `selectedSlot` state
- Pass `instanceStartTime` / `instanceEndTime` to `bookingParams`
- Disable confirm when time-slotted but no slot selected

### 5d. Booking detail

`nativeCom/src/app/booking/[bookingId]/index.tsx`:
- Show booked time slot (`instance_start_time – instance_end_time`) alongside the date in item cards

---

## Edge Cases

1. **Window not divisible by duration**: Last partial slot is dropped (09:00–17:00 with 45min → last slot 15:45–16:30, not 16:30–17:15)
2. **Exception overrides time window and/or duration**: Slots recomputed from overridden window + duration. E.g., provider does 30-min express sessions on a holiday instead of 45-min — more slots generated from the same window
3. **Concurrent bookings**: Different time slots → different rows → no lock contention
4. **Loans ignore duration**: `reserve_item_slots` branches on `is_loan` before checking time — loans always use date-based `reserve_slots_for_range`
5. **Events**: Form hides duration field for events. API rejects `slot_duration_minutes` on event category
6. **Changing duration after bookings exist**: Block at API level if time-slotted instances exist
7. **Capacity meaning**: `slots_available` = capacity per time slot (not per day). A barber with 1 slot and 45-min duration can serve ~10 customers/day

---

## Verification

1. Create a service offering with 45-min slots, 09:00–17:00 window
2. Hit `GET .../time-slots?date=2026-04-15` → expect ~10 slots
3. Book the 09:00 slot → verify `schedule_instances` row with `slot_start_time = 09:00`, `slots_booked = 1`
4. Hit time-slots again → 09:00 shows `is_available: false`, others still available
5. Book the 09:45 slot → verify second instance row
6. Create a loan offering with same schedule → verify it still books date-based (sentinel `00:00:00`)
7. Create an event offering → verify duration field is hidden, booking is date-based
8. Extend e2e test to cover all three paths
