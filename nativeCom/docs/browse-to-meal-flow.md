# Browse → Chef → Meal: Implementation Flow Review

This document reviews the complete data flow from browsing chefs to viewing meal details with availability information.

---

## 1. Architecture Overview

The meal availability system uses a **Schedule/Exception/Instance** architecture:

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| **Schedule** | Recurring availability pattern (RRule) | `meal_availability_schedules` table |
| **Exception** | Date-specific overrides (time, quantity, cancellation) | `meal_availability_exceptions` table |
| **Instance** | Orders placed for a date (`quantity_sold`) | `meal_availability_instances` table |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            chef_all_meals VIEW                              │
│   (aggregates meals + schedules as JSON, pre-filters is_active=true)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         fetchChefMeals(chefId)                              │
│              returns ChefMeal[] with embedded schedules JSON                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         loadMealWithSlots(meal)                             │
│   1. Fetches instances & exceptions for each schedule                       │
│   2. Calls mergeScheduleAvailabilityData()                                  │
│   3. Returns MealWithScheduleSlots                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MealDetailModal                                  │
│   - Uses getMealDisplayContext() for status                                 │
│   - ScheduleDatePicker for slot selection                                   │
│   - Cart integration with slot info                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database View: `chef_all_meals`

The `chef_all_meals` PostgreSQL view is the central data source. Key characteristics:

### Pre-Filtered Data
- **Only returns `is_active=true` schedules** - the `is_active` field is NOT included in the JSON output
- Joins multiple tables: `chef_profiles`, `meals`, `meal_availability_schedules`, etc.

### JSON Structure for Schedules

```typescript
// What the view returns in the `schedules` JSON column:
{
  id: string;
  rrule: string;           // "FREQ=WEEKLY;BYDAY=MO,TU,WE"
  dtstart: string;         // "2026-01-15"
  dtend: string | null;    // "2026-12-31" or null
  start_time: string;      // "11:00:00"
  end_time: string;        // "14:00:00"
  quantity_per_slot: number;  // ⚠️ DB uses this name, NOT max_quantity_per_slot
  slot_label: string | null;
  is_public: boolean;
  community_list?: string[];
  community_ids?: string[];
  // ⚠️ is_active is NOT included (already filtered)
  // ⚠️ Nested exceptions/instances may be included if view is extended
}
```

### Important Field Naming

| TypeScript (was) | Database/View (correct) | Notes |
|------------------|------------------------|-------|
| `max_quantity_per_slot` | `quantity_per_slot` | Max capacity per slot |
| `quantityRemaining` | Computed | `quantity_per_slot - quantity_sold` |
| `quantity_sold` | `quantity_sold` | From instances table |

---

## 3. Type Definitions

### Core Files

| File | Purpose |
|------|---------|
| [types/availability/schedule.ts](../src/types/availability/schedule.ts) | Schedule types, RRule helpers |
| [types/availability/instance.ts](../src/types/availability/instance.ts) | Instance types (quantity_sold) |
| [types/availability/exception.ts](../src/types/availability/exception.ts) | Exception types (overrides) |
| [types/availability/computed.ts](../src/types/availability/computed.ts) | Merged/computed types |

### Key Interfaces

```typescript
// Raw schedule from database view
interface RawScheduleData {
  id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;  // ✅ Correct field name
  slot_label: string | null;
  is_active: boolean;         // Must be added when mapping from view
  is_public?: boolean;
}

// Computed slot (after merging schedule + exception + instance)
interface ScheduleSlot {
  scheduleId: string;
  date: string;               // "YYYY-MM-DD"
  startTime: string;          // "HH:MM" (exception override applied)
  endTime: string;            // "HH:MM" (exception override applied)
  maxQuantity: number;        // Exception override or schedule.quantity_per_slot
  remainingQuantity: number;  // maxQuantity - quantity_sold
  isCancelled: boolean;
  isSoldOut: boolean;
  hasException: boolean;
  slotLabel: string | null;
}

// Final merged meal data
interface MealWithScheduleSlots {
  id: string;
  meal_name: string;
  schedules: ScheduleWithSlots[];  // Each schedule has slots Map
}
```

---

## 4. Screen Flow

### 4.1 Chef Detail Screen ([chefId].tsx:30-355](../src/app/browse/chefs/[chefId].tsx#L30-L355))

**Entry Point:** `/browse/chefs/[chefId]`

1. **Initial Load** (`useEffect` at line 217):
   - Fetches chef details via `fetchChefDetail(chefId)`
   - Fetches meals via `fetchChefMeals(chefId)`

2. **Meal Press** (`handleMealPress` at line 196):
   - Opens modal immediately (shows loading state)
   - Calls `loadMealWithSlots(meal)` to fetch availability

3. **loadMealWithSlots** (line 122-191):
   ```typescript
   // Map view JSON to RawScheduleData format
   const schedules = rawSchedules.map(s => ({
     ...s,
     is_active: true,  // ⚠️ Critical: View already filters, add explicitly
   }));

   // Fetch instances + exceptions for each schedule
   const [instances, exceptions] = await Promise.all([
     getScheduleInstances(mealId, scheduleId, { fromDate, toDate }),
     getScheduleExceptions(mealId, scheduleId, { fromDate, toDate }),
   ]);

   // Merge into MealWithScheduleSlots
   return mergeScheduleAvailabilityData(
     [rawMeal], allInstances, allExceptions, today, inThirtyDays
   );
   ```

### 4.2 Meal Detail Modal ([meal-detail-modal.tsx](../src/components/pages/chef/meals/meal-detail-modal.tsx))

**Two Availability Paths:**

| Path | When Used | Data Source |
|------|-----------|-------------|
| **New (mealWithSlots)** | When `mealWithSlots` prop provided | Pre-computed slots |
| **Legacy (analyzeSchedules)** | Fallback when no slots | JSON parsing only |

**Display Logic:**
```typescript
// New path - accurate availability from merged data
if (mealWithSlots) {
  const ctx = getMealDisplayContext(mealWithSlots);
  // Returns: statusText, statusColor, canOrder, remainingQuantity
}

// Legacy path - only schedule JSON, no instance data
const analysis = analyzeSchedules(schedules);
// ⚠️ Cannot show accurate remainingQuantity (only max capacity)
```

### 4.3 Schedule Date Picker ([schedule-date-picker.tsx](../src/components/pages/chef/meals/schedule-date-picker.tsx))

**Calendar-based slot selection:**

1. Converts `MealWithScheduleSlots` → `CalendarSlotsMap` for week display
2. Uses shared components: `CalendarHeader`, `WeekStrip`, `DaySlotsPicker`
3. Returns `DisplaySlot` with all needed info for cart

---

## 5. Availability Computation

### mergeScheduleAvailabilityData ([schedule-availability.ts:170-214](../src/lib/utils/schedule-availability.ts#L170-L214))

**Process:**
1. Group instances by `schedule_id` → `Map<date, instance>`
2. Group exceptions by `schedule_id` → `Map<date, exception>`
3. For each meal's schedules:
   - Filter `is_active === true`
   - Build slots via `buildScheduleSlots()`

### buildScheduleSlots ([schedule-availability.ts:99-164](../src/lib/utils/schedule-availability.ts#L99-L164))

**For each date in RRule expansion:**
```typescript
// Skip if cancelled
if (exception?.is_cancelled) continue;

// Apply exception overrides
const maxQuantity = exception?.override_quantity ?? schedule.quantity_per_slot;

// Compute remaining from sold
const quantitySold = instance?.quantity_sold ?? 0;
const remainingQuantity = Math.max(0, maxQuantity - quantitySold);
```

---

## 6. Display Status Logic

### getMealDisplayContext ([schedule-availability.ts:345-455](../src/lib/utils/schedule-availability.ts#L345-L455))

**Status Hierarchy:**

| Status | Condition | Color |
|--------|-----------|-------|
| `available` | Now + stock > 5 | Green |
| `low_stock` | Now + stock ≤ 5 | Amber |
| `later_today` | Today, not started | Amber |
| `tomorrow` | Tomorrow | Blue |
| `this_week` | Within 6 days | Blue |
| `future` | Beyond 6 days | Gray |
| `unavailable` | No slots | Gray |

---

## 7. Observations & Recommendations

### Issues Fixed During This Review

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Meals showing "not available" | View doesn't include `is_active`, filter failed | Add `is_active: true` when mapping |
| Type mismatch `max_quantity_per_slot` | DB uses `quantity_per_slot` | Updated all type definitions |
| Legacy path showing max as remaining | No instance data in legacy path | Don't show quantity in legacy UI |
| Duplicate time display in UI | Redundant display logic | Consolidated to single line |

### Potential Improvements

1. **Embed Instances/Exceptions in View**
   - Current: Separate API calls per schedule
   - Better: Add nested JSON arrays to `chef_all_meals` view
   - Impact: Single API call, fewer N+1 queries

2. **Cache Invalidation**
   - When orders are placed, `quantity_sold` changes
   - Consider: React Query or SWR for automatic refetch

3. **Legacy Path Removal**
   - `analyzeSchedules()` is a fallback without real availability
   - Consider: Always require `mealWithSlots` after loading

4. **Type Centralization**
   - Multiple embedded type definitions exist in:
     - `calendar-slots.ts` (EmbeddedSchedule, etc.)
     - `[chefId].tsx` (inline type assertion)
   - Consider: Single source of truth in `types/availability`

5. **Community Filtering**
   - View includes `community_ids` and `community_list`
   - Not yet used in browse flow
   - Future: Filter meals by user's community membership

---

## 8. File Reference

| File | Lines | Purpose |
|------|-------|---------|
| [app/browse/chefs/[chefId].tsx](../src/app/browse/chefs/[chefId].tsx) | 356 | Chef detail screen |
| [components/pages/chef/meals/meal-detail-modal.tsx](../src/components/pages/chef/meals/meal-detail-modal.tsx) | 770 | Meal modal with availability |
| [components/pages/chef/meals/schedule-date-picker.tsx](../src/components/pages/chef/meals/schedule-date-picker.tsx) | 312 | Calendar slot picker |
| [lib/utils/schedule-availability.ts](../src/lib/utils/schedule-availability.ts) | 456 | Merge & display logic |
| [lib/utils/calendar-slots.ts](../src/lib/utils/calendar-slots.ts) | 484 | Calendar computation |
| [types/availability/computed.ts](../src/types/availability/computed.ts) | 310 | Core availability types |
| [types/availability/schedule.ts](../src/types/availability/schedule.ts) | 182 | Schedule types |
| [types/availability/instance.ts](../src/types/availability/instance.ts) | 55 | Instance types |

---

## 9. Quantity Field Reference

**Critical: Understand the quantity fields**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  quantity_per_slot      = Max capacity (from schedule or exception)         │
│  quantity_sold          = Orders placed (from instance)                      │
│  remainingQuantity      = quantity_per_slot - quantity_sold (computed)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Where each is used:**

| Field | Source | Used In |
|-------|--------|---------|
| `quantity_per_slot` | Schedule table / View JSON | `buildScheduleSlots()` |
| `override_quantity` | Exception table | Replaces `quantity_per_slot` if set |
| `quantity_sold` | Instance table (lazy created) | `buildScheduleSlots()` |
| `remainingQuantity` | Computed in merge | UI display, cart validation |
| `maxQuantity` | = `quantity_per_slot` or `override_quantity` | Computed slot field |

---

*Last updated: 2026-01-30*
