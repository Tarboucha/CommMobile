/**
 * Schedule Availability Utilities
 * Merges meals with instances and exceptions to compute availability slots
 */

import {
  parseRRuleWeekdays,
  type RRuleWeekday,
  type RawMealData,
  type RawScheduleData,
  type RawScheduleInstance,
  type RawScheduleException,
  type MealWithScheduleSlots,
  type ScheduleWithSlots,
  type ScheduleSlot,
  type PrimaryStatusType,
  type MealDisplayContext,
  type ViewScheduleData,
} from "@/types/availability";
import type { ChefMeal } from "@/types/browse-chefs";

// ============================================================================
// RRule Expansion
// ============================================================================

/** Map JS Date.getDay() to RRule weekday */
const JS_DAY_TO_RRULE: RRuleWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Expand an RRule to get all dates within a range
 * Currently only supports FREQ=WEEKLY;BYDAY=...
 */
export function expandRRule(
  rrule: string,
  dtstart: string,
  dtend: string | null,
  fromDate: Date,
  toDate: Date
): Date[] {
  const weekdays = parseRRuleWeekdays(rrule);
  if (weekdays.length === 0) return [];

  const dates: Date[] = [];
  const startBound = new Date(Math.max(new Date(dtstart).getTime(), fromDate.getTime()));
  const endBound = dtend
    ? new Date(Math.min(new Date(dtend).getTime(), toDate.getTime()))
    : toDate;

  // Iterate through each day in the range
  const current = new Date(startBound);
  current.setHours(0, 0, 0, 0);

  while (current <= endBound) {
    const dayOfWeek = current.getDay();
    const rruleDay = JS_DAY_TO_RRULE[dayOfWeek];

    if (weekdays.includes(rruleDay)) {
      dates.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============================================================================
// Data Merging
// ============================================================================

/**
 * Group items by schedule_id and create Map<date, item>
 */
function groupByScheduleId<T extends { schedule_id: string }>(
  items: T[],
  dateField: "instance_date" | "exception_date"
): Map<string, Map<string, T>> {
  const result = new Map<string, Map<string, T>>();

  for (const item of items) {
    if (!result.has(item.schedule_id)) {
      result.set(item.schedule_id, new Map());
    }
    const dateValue = (item as Record<string, unknown>)[dateField] as string;
    result.get(item.schedule_id)!.set(dateValue, item);
  }

  return result;
}

/**
 * Format date as "YYYY-MM-DD" using LOCAL date components
 * Note: Using local components instead of toISOString() to avoid timezone issues
 * where setHours(0,0,0,0) sets LOCAL midnight but toISOString() returns UTC
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build ScheduleSlots for a schedule with instance/exception data
 */
export function buildScheduleSlots(
  schedule: RawScheduleData,
  instances: Map<string, RawScheduleInstance>,
  exceptions: Map<string, RawScheduleException>,
  fromDate: Date,
  toDate: Date
): Map<string, ScheduleSlot> {
  const slots = new Map<string, ScheduleSlot>();

  // Expand RRULE for date range
  const dates = expandRRule(
    schedule.rrule,
    schedule.dtstart,
    schedule.dtend,
    fromDate,
    toDate
  );

  for (const date of dates) {
    const dateStr = formatDateISO(date);
    const instance = instances.get(dateStr);
    const exception = exceptions.get(dateStr);

    // Cancelled? Skip
    if (exception?.is_cancelled) {
      continue;
    }

    // Effective max_quantity (use override_quantity from exception if present)
    const maxQuantity = exception?.override_quantity ?? schedule.quantity_per_slot;

    // Max 0 = cancelled
    if (maxQuantity === 0) {
      continue;
    }

    // Compute remaining quantity from quantity_sold
    const quantitySold = instance?.quantity_sold ?? 0;
    const remainingQuantity = Math.max(0, maxQuantity - quantitySold);

    const slot: ScheduleSlot = {
      scheduleId: schedule.id,
      date: dateStr,

      // Times (with exception override)
      startTime: (exception?.override_start_time ?? schedule.start_time).slice(0, 5),
      endTime: (exception?.override_end_time ?? schedule.end_time).slice(0, 5),

      // Quantities
      maxQuantity,
      remainingQuantity,

      // Status
      isCancelled: false,
      isSoldOut: remainingQuantity === 0,
      hasException: !!exception,

      // Display
      slotLabel: schedule.slot_label,
    };

    slots.set(dateStr, slot);
  }

  return slots;
}

/**
 * Merge meals with instances and exceptions to create full availability data
 * Pure function - no side effects
 */
export function mergeScheduleAvailabilityData(
  meals: RawMealData[],
  instances: RawScheduleInstance[],
  exceptions: RawScheduleException[],
  fromDate: string,
  toDate: string
): MealWithScheduleSlots[] {
  // Group by schedule_id for fast lookup
  const instancesBySchedule = groupByScheduleId(instances, "instance_date");
  const exceptionsBySchedule = groupByScheduleId(exceptions, "exception_date");

  const from = new Date(fromDate);
  const to = new Date(toDate);

  return meals.map((meal) => ({
    id: meal.id,
    meal_name: meal.meal_name,
    meal_description: meal.meal_description,
    price_amount: meal.price_amount,
    currency_code: meal.currency_code,
    preparation_time_minutes: meal.preparation_time_minutes,
    chef_profile_id: meal.chef_profile_id,
    schedules: (meal.meal_availability_schedules || [])
      .filter((s) => s.is_active)
      .map((schedule): ScheduleWithSlots => {
        const scheduleInstances = instancesBySchedule.get(schedule.id) || new Map();
        const scheduleExceptions = exceptionsBySchedule.get(schedule.id) || new Map();

        const slots = buildScheduleSlots(
          schedule,
          scheduleInstances,
          scheduleExceptions,
          from,
          to
        );

        return {
          ...schedule,
          slots,
          instances: Array.from(scheduleInstances.values()),
          exceptions: Array.from(scheduleExceptions.values()),
        };
      }),
  }));
}

// ============================================================================
// Helper Functions for Slots
// ============================================================================

/**
 * Get the first available slot for a meal (across all schedules)
 */
export function getFirstAvailableSlot(
  meal: MealWithScheduleSlots
): ScheduleSlot | null {
  const now = new Date();
  const today = formatDateISO(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let firstSlot: ScheduleSlot | null = null;

  for (const schedule of meal.schedules) {
    for (const [, slot] of schedule.slots) {
      // Skip sold out slots
      if (slot.isSoldOut) continue;

      // If today, check if time hasn't passed
      if (slot.date === today) {
        const endMinutes = timeToMinutes(slot.endTime);
        if (currentMinutes >= endMinutes) continue;
      }

      // Compare with current first slot
      if (!firstSlot || slot.date < firstSlot.date) {
        firstSlot = slot;
      } else if (slot.date === firstSlot.date) {
        // Same date - compare times
        if (timeToMinutes(slot.startTime) < timeToMinutes(firstSlot.startTime)) {
          firstSlot = slot;
        }
      }
    }
  }

  return firstSlot;
}

// ============================================================================
// Slot Display Info
// ============================================================================

/**
 * Extended slot info with display labels
 * Used for cart operations and UI display
 */
export interface SlotDisplayInfo extends ScheduleSlot {
  dayLabel: string;        // "Today", "Tomorrow", "Wed, Jan 22"
  timeLabel: string;       // "12:00 - 14:00"
  isToday: boolean;
  isTomorrow: boolean;
  daysFromNow: number;
}

/**
 * Convert ScheduleSlot to SlotDisplayInfo with computed display labels
 */
export function getSlotDisplayInfo(slot: ScheduleSlot): SlotDisplayInfo {
  const now = new Date();
  const slotDate = new Date(slot.date + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysFromNow = Math.round(
    (slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  let dayLabel: string;
  if (daysFromNow === 0) {
    dayLabel = 'Today';
  } else if (daysFromNow === 1) {
    dayLabel = 'Tomorrow';
  } else {
    dayLabel = slotDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  return {
    ...slot,
    dayLabel,
    timeLabel: `${slot.startTime} - ${slot.endTime}`,
    isToday: daysFromNow === 0,
    isTomorrow: daysFromNow === 1,
    daysFromNow,
  };
}

/**
 * Get first available slot with full display info
 */
export function getFirstAvailableSlotWithDisplay(
  meal: MealWithScheduleSlots
): SlotDisplayInfo | null {
  const slot = getFirstAvailableSlot(meal);
  if (!slot) return null;
  return getSlotDisplayInfo(slot);
}

/**
 * Get all available slots for a specific date (across all schedules)
 */
export function getSlotsForDate(
  meal: MealWithScheduleSlots,
  date: string
): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];

  for (const schedule of meal.schedules) {
    const slot = schedule.slots.get(date);
    if (slot && !slot.isSoldOut) {
      slots.push(slot);
    }
  }

  // Sort by start time
  return slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Get all available dates for a meal
 */
export function getAvailableDates(meal: MealWithScheduleSlots): string[] {
  const dates = new Set<string>();

  for (const schedule of meal.schedules) {
    for (const [date, slot] of schedule.slots) {
      if (!slot.isSoldOut) {
        dates.add(date);
      }
    }
  }

  return Array.from(dates).sort();
}

/**
 * Check if a meal has any available slots
 */
export function hasAvailableSlots(meal: MealWithScheduleSlots): boolean {
  for (const schedule of meal.schedules) {
    for (const [, slot] of schedule.slots) {
      if (!slot.isSoldOut) return true;
    }
  }
  return false;
}

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// ============================================================================
// Display Context Generation
// ============================================================================

const DISPLAY_STATUS_COLORS: Record<PrimaryStatusType, string> = {
  available: "#10B981",
  low_stock: "#F59E0B",
  later_today: "#F59E0B",
  tomorrow: "#3B82F6",
  this_week: "#3B82F6",
  future: "#64748B",
  unavailable: "#6B7280",
};

const DISPLAY_STATUS_ICONS: Record<PrimaryStatusType, string> = {
  available: "checkmark-circle",
  low_stock: "alert-circle",
  later_today: "time",
  tomorrow: "calendar",
  this_week: "calendar-outline",
  future: "calendar-outline",
  unavailable: "ban",
};

/**
 * Generate MealDisplayContext from MealWithScheduleSlots
 * Used for displaying availability status in MealCard
 */
export function getMealDisplayContext(
  meal: MealWithScheduleSlots
): MealDisplayContext {
  const now = new Date();
  const todayStr = formatDateISO(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const firstSlot = getFirstAvailableSlot(meal);

  // No available slots
  if (!firstSlot) {
    return {
      primaryStatus: "unavailable",
      statusText: "Not available",
      statusColor: DISPLAY_STATUS_COLORS.unavailable,
      statusIcon: DISPLAY_STATUS_ICONS.unavailable,
      canOrder: false,
    };
  }

  const isToday = firstSlot.date === todayStr;
  const startMinutes = timeToMinutes(firstSlot.startTime);
  const endMinutes = timeToMinutes(firstSlot.endTime);

  // Check if available now
  const isNow = isToday && currentMinutes >= startMinutes && currentMinutes < endMinutes;

  // Calculate days from now
  const slotDate = new Date(firstSlot.date + "T00:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysFromNow = Math.round((slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const LOW_STOCK_THRESHOLD = 5;
  const isLowStock = firstSlot.remainingQuantity <= LOW_STOCK_THRESHOLD;

  // Format schedule display
  const scheduleDisplay = firstSlot.slotLabel
    ? `${firstSlot.slotLabel} ${firstSlot.startTime}-${firstSlot.endTime}`
    : `${firstSlot.startTime}-${firstSlot.endTime}`;

  // Available now
  if (isNow) {
    const primaryStatus: PrimaryStatusType = isLowStock ? "low_stock" : "available";
    return {
      primaryStatus,
      statusText: isLowStock
        ? `Only ${firstSlot.remainingQuantity} left!`
        : `${firstSlot.remainingQuantity} available`,
      statusColor: DISPLAY_STATUS_COLORS[primaryStatus],
      statusIcon: DISPLAY_STATUS_ICONS[primaryStatus],
      canOrder: true,
      scheduleDisplay,
      remainingQuantity: firstSlot.remainingQuantity,
    };
  }

  // Later today
  if (isToday) {
    return {
      primaryStatus: "later_today",
      statusText: `From ${firstSlot.startTime}`,
      statusColor: DISPLAY_STATUS_COLORS.later_today,
      statusIcon: DISPLAY_STATUS_ICONS.later_today,
      canOrder: true,
      scheduleDisplay,
      remainingQuantity: firstSlot.remainingQuantity,
    };
  }

  // Tomorrow
  if (daysFromNow === 1) {
    return {
      primaryStatus: "tomorrow",
      statusText: `Tomorrow ${firstSlot.startTime}`,
      statusColor: DISPLAY_STATUS_COLORS.tomorrow,
      statusIcon: DISPLAY_STATUS_ICONS.tomorrow,
      canOrder: true,
      scheduleDisplay,
      remainingQuantity: firstSlot.remainingQuantity,
    };
  }

  // This week
  if (daysFromNow <= 6) {
    const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = WEEKDAY_SHORT[slotDate.getDay()];
    return {
      primaryStatus: "this_week",
      statusText: `${dayName} ${firstSlot.startTime}`,
      statusColor: DISPLAY_STATUS_COLORS.this_week,
      statusIcon: DISPLAY_STATUS_ICONS.this_week,
      canOrder: true,
      scheduleDisplay,
      remainingQuantity: firstSlot.remainingQuantity,
    };
  }

  // Future
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = MONTH_SHORT[slotDate.getMonth()];
  const day = slotDate.getDate();
  return {
    primaryStatus: "future",
    statusText: `${monthName} ${day}`,
    statusColor: DISPLAY_STATUS_COLORS.future,
    statusIcon: DISPLAY_STATUS_ICONS.future,
    canOrder: true,
    scheduleDisplay,
    remainingQuantity: firstSlot.remainingQuantity,
  };
}

// ============================================================================
// Transform Functions (View Data → MealWithScheduleSlots)
// ============================================================================

/**
 * Transform ChefMeal (from chef_all_meals view) to MealWithScheduleSlots
 * Uses nested exceptions/instances from the view instead of separate API calls
 *
 * @param meal - ChefMeal from chef_all_meals view
 * @param fromDate - Start date for slot computation (YYYY-MM-DD)
 * @param toDate - End date for slot computation (YYYY-MM-DD)
 * @returns MealWithScheduleSlots with computed slots, or null if no schedules
 */
export function transformMealToMealWithSlots(
  meal: ChefMeal,
  fromDate: string,
  toDate: string
): MealWithScheduleSlots | null {
  // Extract schedules with nested exceptions/instances from the view
  const rawSchedules = meal.schedules as ViewScheduleData[] | null;
  if (!rawSchedules?.length) return null;

  // Filter to active, public schedules only
  const activeSchedules = rawSchedules.filter(
    (s) => s.is_public !== false // is_public could be undefined, treat as public
  );

  if (activeSchedules.length === 0) return null;

  // Build RawMealData format for mergeScheduleAvailabilityData
  const rawMeal: RawMealData = {
    id: meal.id ?? "",
    meal_name: meal.meal_name ?? "",
    meal_description: meal.meal_description ?? null,
    price_amount: meal.price_amount ?? 0,
    currency_code: meal.currency_code ?? "EUR",
    preparation_time_minutes: meal.preparation_time_minutes ?? null,
    chef_profile_id: meal.chef_profile_id ?? "",
    meal_availability_schedules: activeSchedules.map((s) => ({
      id: s.id,
      rrule: s.rrule,
      dtstart: s.dtstart,
      dtend: s.dtend,
      start_time: s.start_time,
      end_time: s.end_time,
      quantity_per_slot: s.quantity_per_slot,
      slot_label: s.slot_label,
      is_active: true, // View pre-filters active schedules
      is_public: s.is_public,
    })),
  };

  // Extract all instances from nested data (add schedule_id and synthetic id)
  const allInstances: RawScheduleInstance[] = activeSchedules.flatMap((s) =>
    (s.instances || []).map((inst) => ({
      id: `${s.id}_${inst.instance_date}`, // Synthetic ID (schedule_id + date)
      schedule_id: s.id,
      instance_date: inst.instance_date,
      quantity_sold: inst.quantity_sold,
    }))
  );

  // Extract all exceptions from nested data (add schedule_id)
  const allExceptions: RawScheduleException[] = activeSchedules.flatMap((s) =>
    (s.exceptions || []).map((exc) => ({
      id: exc.id,
      schedule_id: s.id,
      exception_date: exc.exception_date,
      is_cancelled: exc.is_cancelled,
      override_quantity: exc.override_quantity,
      override_start_time: exc.override_start_time,
      override_end_time: exc.override_end_time,
      reason: exc.reason,
    }))
  );

  // Use existing merge function to compute slots
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
 * Batch transform all meals to MealWithScheduleSlots
 * Creates a Map for O(1) lookup by meal ID
 *
 * @param meals - Array of ChefMeal from chef_all_meals view
 * @param fromDate - Start date for slot computation (YYYY-MM-DD)
 * @param toDate - End date for slot computation (YYYY-MM-DD)
 * @returns Map of meal ID to MealWithScheduleSlots
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
