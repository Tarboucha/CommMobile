# Testing Guide for nativeComChefs

A practical guide focused on testing **complex logic that's hard to verify manually**.

---

## What's Worth Testing?

Not everything needs tests. Focus on code where:
- **Edge cases are hard to trigger** (timezone at midnight, leap years)
- **Bugs are subtle** (off-by-one errors in dates)
- **Many code paths exist** (grouping logic with 8+ statuses)
- **Manual verification is tedious** (retry backoff timing)

### Test This ✅

| Code | Why |
|------|-----|
| `schedule-availability.ts` | Complex date math, timezone edge cases |
| `withRetry` utility | Backoff timing, error code handling |
| `groupMealsSmart` | Many code paths, sorting logic |
| Time overlap calculations | Edge cases around midnight |

### Skip This ❌

| Code | Why |
|------|-----|
| `useAddToCart` hook | Just orchestrates store calls - test by clicking |
| Simple UI components | Visual - just look at the app |
| API fetch wrappers | Already tested when you use the app |
| CRUD operations | Low complexity |

---

## Setup

### Install (Official Expo Command)

```bash
npx expo install jest-expo jest @types/jest --dev
```

### Configure package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watchAll"
  },
  "jest": {
    "preset": "jest-expo",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    }
  }
}
```

### Folder Structure

```
src/
├── __tests__/
│   └── lib/
│       └── utils/
│           ├── schedule-availability.test.ts
│           └── retry.test.ts
```

> **Important:** Don't put tests inside `app/` (Expo Router requirement)

---

## Example 1: Testing Date Logic

This is the **most valuable** test in your codebase. Date calculations are notoriously buggy.

**File: `src/__tests__/lib/utils/schedule-availability.test.ts`**

```typescript
import { getSlotDisplayInfo } from '@/lib/utils/schedule-availability';
import type { ScheduleSlot } from '@/types/availability';

describe('getSlotDisplayInfo', () => {
  // Helper to create test slots
  const createSlot = (overrides: Partial<ScheduleSlot> = {}): ScheduleSlot => ({
    scheduleId: 'schedule-1',
    date: '2024-01-15',
    startTime: '12:00',
    endTime: '14:00',
    maxQuantity: 10,
    remainingQuantity: 5,
    isCancelled: false,
    isSoldOut: false,
    hasException: false,
    slotLabel: 'Lunch',
    ...overrides,
  });

  // Helper to get date string in local timezone
  const getLocalDateString = (daysFromNow: number = 0): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  describe('timeLabel formatting', () => {
    it('should format time range correctly', () => {
      const slot = createSlot({ startTime: '09:00', endTime: '11:00' });
      expect(getSlotDisplayInfo(slot).timeLabel).toBe('09:00 - 11:00');
    });

    it('should handle single-digit hours', () => {
      const slot = createSlot({ startTime: '08:30', endTime: '09:45' });
      expect(getSlotDisplayInfo(slot).timeLabel).toBe('08:30 - 09:45');
    });
  });

  describe('dayLabel - relative dates', () => {
    it('should return "Today" for current date', () => {
      const slot = createSlot({ date: getLocalDateString(0) });
      const result = getSlotDisplayInfo(slot);

      expect(result.isToday).toBe(true);
      expect(result.dayLabel).toBe('Today');
      expect(result.daysFromNow).toBe(0);
    });

    it('should return "Tomorrow" for next day', () => {
      const slot = createSlot({ date: getLocalDateString(1) });
      const result = getSlotDisplayInfo(slot);

      expect(result.isTomorrow).toBe(true);
      expect(result.dayLabel).toBe('Tomorrow');
      expect(result.daysFromNow).toBe(1);
    });

    it('should format dates 2+ days away with day name', () => {
      const slot = createSlot({ date: getLocalDateString(5) });
      const result = getSlotDisplayInfo(slot);

      expect(result.isToday).toBe(false);
      expect(result.isTomorrow).toBe(false);
      expect(result.daysFromNow).toBe(5);
      // Should match pattern like "Mon, Jan 20"
      expect(result.dayLabel).toMatch(/^\w{3}, \w{3} \d{1,2}$/);
    });
  });

  describe('edge cases', () => {
    it('should handle year boundary (Dec 31 -> Jan 1)', () => {
      // Test that daysFromNow calculation works across year boundary
      const dec31 = '2024-12-31';
      const jan1 = '2025-01-01';

      const slotDec = createSlot({ date: dec31 });
      const slotJan = createSlot({ date: jan1 });

      const resultDec = getSlotDisplayInfo(slotDec);
      const resultJan = getSlotDisplayInfo(slotJan);

      // Jan 1 should be 1 day after Dec 31
      expect(resultJan.daysFromNow - resultDec.daysFromNow).toBe(1);
    });

    it('should preserve all original slot properties', () => {
      const slot = createSlot({
        scheduleId: 'test-123',
        remainingQuantity: 3,
        slotLabel: 'Dinner',
      });
      const result = getSlotDisplayInfo(slot);

      expect(result.scheduleId).toBe('test-123');
      expect(result.remainingQuantity).toBe(3);
      expect(result.slotLabel).toBe('Dinner');
    });
  });
});
```

---

## Example 2: Testing Retry Logic

Tests the backoff algorithm and error handling - hard to verify manually.

**File: `src/__tests__/lib/utils/retry.test.ts`**

```typescript
import { withRetry } from '@/lib/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful operations', () => {
    it('should return immediately on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
      await jest.runAllTimersAsync();

      expect(await promise).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('failure cases', () => {
    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      const promise = withRetry(fn, { maxRetries: 3 });
      await jest.runAllTimersAsync();

      await expect(promise).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('error code handling', () => {
    it('should NOT retry 400 Bad Request', async () => {
      const error = { status: 400, message: 'Bad request' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should NOT retry 401 Unauthorized', async () => {
      const error = { status: 401, message: 'Unauthorized' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry 404 Not Found', async () => {
      const error = { status: 404, message: 'Not found' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('SHOULD retry 408 Timeout', async () => {
      const error = { status: 408, message: 'Timeout' };
      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 2 });
      await jest.runAllTimersAsync();

      expect(await promise).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('SHOULD retry 429 Rate Limited', async () => {
      const error = { status: 429, message: 'Rate limited' };
      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 2 });
      await jest.runAllTimersAsync();

      expect(await promise).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('SHOULD retry 500 Server Error', async () => {
      const error = { status: 500, message: 'Server error' };
      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 2 });
      await jest.runAllTimersAsync();

      expect(await promise).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
```

---

## Example 3: Testing Meal Grouping Logic

Many code paths make this hard to verify manually.

**File: `src/__tests__/lib/utils/meal-grouping.test.ts`**

```typescript
import { groupMealsSmart } from '@/lib/utils/meal-grouping';
import type { MealWithScheduleSlots } from '@/types/availability';

describe('groupMealsSmart', () => {
  const createMockMeal = (overrides = {}) => ({
    id: 'meal-1',
    meal_name: 'Test Meal',
    is_featured: false,
    ...overrides,
  });

  const createMockSlots = (status: string): MealWithScheduleSlots => ({
    // ... mock structure based on status
  } as MealWithScheduleSlots);

  it('should put featured meals in featured group', () => {
    const meals = [
      createMockMeal({ id: '1', is_featured: true }),
      createMockMeal({ id: '2', is_featured: false }),
    ];
    const slotsMap = new Map();

    const groups = groupMealsSmart(meals as any, slotsMap);
    const featuredGroup = groups.find(g => g.groupId === 'featured');

    expect(featuredGroup).toBeDefined();
    expect(featuredGroup?.meals).toHaveLength(1);
    expect(featuredGroup?.meals[0].id).toBe('1');
  });

  it('should sort groups by displayOrder', () => {
    // Test that groups appear in correct order:
    // featured -> available_now -> later_today -> tomorrow -> etc.
    const groups = groupMealsSmart(mockMeals, mockSlotsMap);
    const groupIds = groups.map(g => g.groupId);

    const featuredIndex = groupIds.indexOf('featured');
    const availableIndex = groupIds.indexOf('available_now');
    const tomorrowIndex = groupIds.indexOf('tomorrow');

    if (featuredIndex >= 0 && availableIndex >= 0) {
      expect(featuredIndex).toBeLessThan(availableIndex);
    }
    if (availableIndex >= 0 && tomorrowIndex >= 0) {
      expect(availableIndex).toBeLessThan(tomorrowIndex);
    }
  });

  it('should not create empty groups', () => {
    const groups = groupMealsSmart([], new Map());

    groups.forEach(group => {
      expect(group.meals.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on changes)
pnpm test:watch

# Run specific file
pnpm test schedule-availability
```

---

## Quick Reference

### Common Matchers

```typescript
expect(value).toBe(exact);           // === equality
expect(value).toEqual(object);       // Deep equality
expect(value).toMatch(/regex/);      // Regex match
expect(array).toContain(item);       // Array contains
expect(array).toHaveLength(3);       // Array length
expect(fn).toHaveBeenCalledTimes(2); // Function call count
```

### Testing Async Code

```typescript
it('should handle async', async () => {
  const result = await someAsyncFn();
  expect(result).toBe('expected');
});

it('should reject', async () => {
  await expect(failingFn()).rejects.toThrow('error');
});
```

### Fake Timers (for retry/debounce logic)

```typescript
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('should wait', async () => {
  const promise = delayedFn();
  await jest.runAllTimersAsync();
  expect(await promise).toBe('done');
});
```

---

## Summary

Focus your testing energy on:

1. **Date/time calculations** - `schedule-availability.ts`
2. **Algorithm edge cases** - `withRetry`, `groupMealsSmart`
3. **Complex validation** - time overlap, quantity checks

Don't waste time testing:
- Simple hooks that just call other functions
- UI components (just look at them)
- CRUD wrappers

> **Reference:** [Expo Unit Testing Docs](https://docs.expo.dev/develop/unit-testing/)
