# Plan: Schedule Data Flow Refactor

## Problem Statement

The `chef_all_meals` database view already returns complete schedule data including nested `exceptions` and `instances` arrays, but the client code makes **redundant API calls** to fetch the same data separately.

### Current Flow (Inefficient)
```
chef_all_meals view
    └─> Returns: meal.schedules[].exceptions[] & meal.schedules[].instances[]
            ↓
[chefId].tsx handleMealPress()
    └─> Opens modal with meal data
    └─> Calls loadMealWithSlots() async
            ↓
loadMealWithSlots()
    └─> IGNORES nested exceptions/instances
    └─> Makes API calls for EACH schedule:
        - getScheduleInstances(mealId, scheduleId)  ← REDUNDANT
        - getScheduleExceptions(mealId, scheduleId) ← REDUNDANT
            ↓
mergeScheduleAvailabilityData()
    └─> Computes slots from fetched data
            ↓
Modal shows "Loading schedule..." then displays data
```

**Issues:**
- 2 API calls per schedule (meal with 3 schedules = 6 extra requests)
- Loading state in modal while waiting for redundant data
- Data already available is being ignored
- Inconsistent UX (flash of loading state)

---

## Target Flow (Optimized)

```
chef_all_meals view
    └─> Returns: meal.schedules[].exceptions[] & meal.schedules[].instances[]
            ↓
[chefId].tsx (on meals load)
    └─> Transform meals to MealWithScheduleSlots[] immediately
    └─> Store as mealsWithSlots state
            ↓
handleMealPress()
    └─> Find mealWithSlots from pre-computed data
    └─> Open modal with data ready (NO loading state)
            ↓
Modal displays immediately with full schedule data
```

**Benefits:**
- Zero additional API calls
- No loading state in modal
- Data computed once when meals load
- Cleaner, simpler code

---

## Implementation Steps

### Step 1: Create Utility to Transform View Data to MealWithScheduleSlots

**File:** `src/lib/utils/schedule-availability.ts`

Add new function that extracts nested exceptions/instances from view data:

```typescript
/**
 * Transform ChefMeal (from view) to MealWithScheduleSlots
 * Uses nested exceptions/instances from the view instead of separate API calls
 */
export function transformMealToMealWithSlots(
  meal: ChefMeal,
  fromDate: string,
  toDate: string
): MealWithScheduleSlots | null {
  // Extract schedules with nested exceptions/instances
  const rawSchedules = meal.schedules as ViewScheduleData[] | null;
  if (!rawSchedules?.length) return null;

  // Build RawMealData format
  const rawMeal: RawMealData = {
    id: meal.id!,
    meal_name: meal.meal_name,
    // ... other fields
    meal_availability_schedules: rawSchedules.map(s => ({
      ...s,
      is_active: true, // View pre-filters
    })),
  };

  // Extract all instances from nested data
  const allInstances: RawScheduleInstance[] = rawSchedules.flatMap(s =>
    (s.instances || []).map(inst => ({
      ...inst,
      schedule_id: s.id,
    }))
  );

  // Extract all exceptions from nested data
  const allExceptions: RawScheduleException[] = rawSchedules.flatMap(s =>
    (s.exceptions || []).map(exc => ({
      ...exc,
      schedule_id: s.id,
    }))
  );

  // Use existing merge function
  const merged = mergeScheduleAvailabilityData(
    [rawMeal],
    allInstances,
    allExceptions,
    fromDate,
    toDate
  );

  return merged[0] || null;
}

/**
 * Batch transform all meals
 */
export function transformMealsToMealsWithSlots(
  meals: ChefMeal[],
  fromDate: string,
  toDate: string
): Map<string, MealWithScheduleSlots> {
  const result = new Map<string, MealWithScheduleSlots>();

  for (const meal of meals) {
    if (!meal.id) continue;
    const transformed = transformMealToMealWithSlots(meal, fromDate, toDate);
    if (transformed) {
      result.set(meal.id, transformed);
    }
  }

  return result;
}
```

### Step 2: Add Type for View Schedule Data

**File:** `src/types/availability.ts`

Add type that matches what the view returns:

```typescript
/**
 * Schedule data as returned by chef_all_meals view
 * Includes nested exceptions and instances
 */
export interface ViewScheduleData {
  id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;
  slot_label: string | null;
  is_public: boolean;
  community_list: string[] | null;
  community_ids: string[] | null;
  // Nested data from view
  exceptions: Array<{
    id: string;
    exception_date: string;
    is_cancelled: boolean;
    override_quantity: number | null;
    override_start_time: string | null;
    override_end_time: string | null;
    reason: string | null;
  }> | null;
  instances: Array<{
    instance_date: string;
    quantity_sold: number;
  }> | null;
}
```

### Step 3: Update [chefId].tsx

**File:** `src/app/browse/chefs/[chefId].tsx`

Remove redundant API calls and pre-compute slots:

```typescript
// REMOVE these imports:
// import { getScheduleInstances } from '@/lib/api/meals/instances';
// import { getScheduleExceptions } from '@/lib/api/meals/exceptions';

// ADD this import:
import { transformMealsToMealsWithSlots } from '@/lib/utils/schedule-availability';

// In component:
const [mealsWithSlots, setMealsWithSlots] = useState<Map<string, MealWithScheduleSlots>>(new Map());

// After meals are fetched, compute slots immediately:
useEffect(() => {
  if (meals.length > 0) {
    const now = new Date();
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = formatLocalDate(now);
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const inThirtyDays = formatLocalDate(thirtyDaysLater);

    const slotsMap = transformMealsToMealsWithSlots(meals, today, inThirtyDays);
    setMealsWithSlots(slotsMap);
  }
}, [meals]);

// REMOVE loadMealWithSlots callback entirely

// UPDATE handleMealPress:
const handleMealPress = useCallback((meal: ChefMeal) => {
  setSelectedMeal(meal);
  // Get pre-computed slots directly (no async, no loading state)
  const mealWithSlots = meal.id ? mealsWithSlots.get(meal.id) : null;
  setSelectedMealWithSlots(mealWithSlots || null);
  setIsMealModalVisible(true);
}, [mealsWithSlots]);
```

### Step 4: Update MealDetailModal

**File:** `src/components/pages/chef/meals/meal-detail-modal.tsx`

Since `mealWithSlots` is now always available when modal opens:

```typescript
// isScheduleLoading will now always be false (or only true briefly)
// Can simplify or keep for edge cases
const isScheduleLoading = !mealWithSlots;
```

### Step 5: Clean Up Unused Code

**Files to potentially remove or deprecate:**
- `src/lib/api/meals/instances.ts` - No longer needed for this flow
- `src/lib/api/meals/exceptions.ts` - No longer needed for this flow

**Note:** Keep these files if they're used elsewhere (e.g., chef app for managing schedules)

### Step 6: Update Meal Cards (Optional Enhancement)

Since `mealsWithSlots` is now available, meal cards can show accurate availability:

```typescript
// In meal card component, can now receive mealWithSlots prop
// and show real-time sold-out status, remaining quantities, etc.
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/types/availability.ts` | Add `ViewScheduleData` type |
| `src/lib/utils/schedule-availability.ts` | Add `transformMealToMealWithSlots`, `transformMealsToMealsWithSlots` |
| `src/app/browse/chefs/[chefId].tsx` | Remove API calls, pre-compute slots, simplify handleMealPress |
| `src/components/pages/chef/meals/meal-detail-modal.tsx` | Minor cleanup (loading state rarely triggers) |

---

## Files to Remove/Deprecate (if not used elsewhere)

| File | Status |
|------|--------|
| `src/lib/api/meals/instances.ts` | Check usage, possibly deprecate |
| `src/lib/api/meals/exceptions.ts` | Check usage, possibly deprecate |

---

## Testing Checklist

- [ ] Modal opens without loading state
- [ ] Schedule displays correctly (today's slot shown)
- [ ] Tomorrow/future slots display correctly
- [ ] Sold-out slots handled properly
- [ ] Exceptions (cancelled dates) handled properly
- [ ] Quantity overrides from exceptions work
- [ ] Time overrides from exceptions work
- [ ] Date picker shows correct available dates
- [ ] Cart add works with correct slot info

---

## Rollback Plan

If issues arise:
1. Revert to using `loadMealWithSlots` with API calls
2. Keep `transformMealsToMealsWithSlots` but don't use it
3. The view data structure remains unchanged

---

## Performance Impact

**Before:**
- Modal open: 2+ API calls per schedule
- Wait time: ~200-500ms network latency

**After:**
- Modal open: 0 API calls
- Wait time: 0ms (data pre-computed)
- Initial page load: +10-50ms for slot computation (negligible)
