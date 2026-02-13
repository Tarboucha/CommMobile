import { RRule } from "rrule";
import type {
  ScheduleException,
  CalendarSlot,
  DaySlots,
  CalendarSlotsMap,
} from "@/types/availability";

/**
 * Calendar Slots Utility
 *
 * Berechnet Kalender-Slots aus:
 * 1. Schedules (mit RRule) - definieren wann Meals verfügbar sind
 * 2. Exceptions - Überschreibungen für einzelne Tage
 * 3. Instances - quantity_sold pro Tag (lazy created bei Orders)
 */

/**
 * Schedule input for computeCalendarSlots
 * Minimal interface that works with both API and embedded data
 */
export interface CalendarScheduleInput {
  id: string;
  meal_id: string;
  meal_name: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;
  slot_label: string | null;
  is_public: boolean;
}

/**
 * Instance input for computeCalendarSlots
 */
export interface CalendarInstanceInput {
  schedule_id: string;
  instance_date: string;
  quantity_sold: number;
}

/**
 * Parse RRule weekdays to day indices (0=Monday, 6=Sunday in RRule convention)
 */
function parseRRuleWeekdays(rruleStr: string): number[] {
  try {
    const rule = RRule.fromString(rruleStr);
    const byweekday = rule.options.byweekday;

    if (!byweekday) return [];

    return byweekday.map((day) => {
      if (typeof day === "number") {
        return day;
      }
      return (day as { weekday: number }).weekday;
    });
  } catch {
    return [];
  }
}

/**
 * Check if a date falls on one of the specified weekdays
 * @param date The date to check
 * @param weekdays Array of weekday indices (0=Monday, 6=Sunday in RRule convention)
 */
function isDateOnWeekday(date: Date, weekdays: number[]): boolean {
  // JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
  // RRule: 0=Monday, 1=Tuesday, ..., 6=Sunday
  const jsDay = date.getDay();
  const rruleDay = jsDay === 0 ? 6 : jsDay - 1;
  return weekdays.includes(rruleDay);
}

/**
 * Check if a date is within schedule validity period
 */
function isDateInScheduleRange(
  date: Date,
  dtstart: string,
  dtend: string | null
): boolean {
  const dateStr = formatDateStr(date);
  if (dateStr < dtstart) return false;
  if (dtend && dateStr > dtend) return false;
  return true;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compute calendar slots for a date range
 *
 * @param schedules - Active schedules with RRule
 * @param exceptions - Exceptions for the date range
 * @param instances - Instances with quantity_sold
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 * @returns Map of date string to DaySlots
 */
export function computeCalendarSlots(
  schedules: CalendarScheduleInput[],
  exceptions: ScheduleException[],
  instances: CalendarInstanceInput[],
  fromDate: string,
  toDate: string
): CalendarSlotsMap {
  const slotsMap: CalendarSlotsMap = new Map();

  // Create lookup maps for exceptions and instances
  const exceptionMap = new Map<string, ScheduleException>();
  for (const exc of exceptions) {
    const key = `${exc.schedule_id}_${exc.exception_date}`;
    exceptionMap.set(key, exc);
  }

  const instanceMap = new Map<string, CalendarInstanceInput>();
  for (const inst of instances) {
    const key = `${inst.schedule_id}_${inst.instance_date}`;
    instanceMap.set(key, inst);
  }

  // Parse date range
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const startDate = new Date(fromYear, fromMonth - 1, fromDay);
  const endDate = new Date(toYear, toMonth - 1, toDay);

  // Iterate through each schedule
  for (const schedule of schedules) {
    // Parse schedule date boundaries
    const [dtstartYear, dtstartMonth, dtstartDay] = schedule.dtstart
      .split("-")
      .map(Number);
    const scheduleStart = new Date(dtstartYear, dtstartMonth - 1, dtstartDay);

    let scheduleEnd: Date | null = null;
    if (schedule.dtend) {
      const [dtendYear, dtendMonth, dtendDay] = schedule.dtend
        .split("-")
        .map(Number);
      scheduleEnd = new Date(dtendYear, dtendMonth - 1, dtendDay);
    }

    // Parse RRule weekdays
    const weekdays = parseRRuleWeekdays(schedule.rrule);
    if (weekdays.length === 0) continue;

    // Iterate through date range
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const currentDate = new Date(d);
      const dateStr = formatDateStr(currentDate);

      // Check if current date is within schedule validity period
      if (currentDate < scheduleStart) continue;
      if (scheduleEnd && currentDate > scheduleEnd) continue;

      // Check if current day matches RRule pattern
      if (!isDateOnWeekday(currentDate, weekdays)) continue;

      // Look up exception and instance
      const lookupKey = `${schedule.id}_${dateStr}`;
      const exception = exceptionMap.get(lookupKey);
      const instance = instanceMap.get(lookupKey);

      // Build slot with exception overrides applied
      const slot: CalendarSlot = {
        schedule_id: schedule.id,
        meal_id: schedule.meal_id,
        meal_name: schedule.meal_name,
        date: dateStr,
        start_time: exception?.override_start_time || schedule.start_time,
        end_time: exception?.override_end_time || schedule.end_time,
        quantity_available:
          exception?.override_quantity ?? schedule.quantity_per_slot,
        quantity_sold: instance?.quantity_sold || 0,
        slot_label: schedule.slot_label,
        is_public: schedule.is_public,
        is_cancelled: exception?.is_cancelled || false,
        has_exception: !!exception,
        exception_reason: exception?.reason || null,
      };

      // Add slot to day
      if (!slotsMap.has(dateStr)) {
        slotsMap.set(dateStr, {
          date: dateStr,
          slots: [],
          totalAvailable: 0,
          totalSold: 0,
          hasCancelled: false,
        });
      }

      const daySlots = slotsMap.get(dateStr)!;
      daySlots.slots.push(slot);

      if (!slot.is_cancelled) {
        daySlots.totalAvailable += slot.quantity_available;
        daySlots.totalSold += slot.quantity_sold;
      } else {
        daySlots.hasCancelled = true;
      }
    }
  }

  // Sort slots within each day by start_time
  for (const daySlots of slotsMap.values()) {
    daySlots.slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return slotsMap;
}

/**
 * Get date range for a month (exact month boundaries)
 */
export function getMonthDateRange(year: number, month: number): {
  fromDate: string;
  toDate: string;
} {
  // First day of month
  const firstDay = new Date(year, month, 1);
  const fromDate = formatDateStr(firstDay);

  // Last day of month
  const lastDay = new Date(year, month + 1, 0);
  const toDate = formatDateStr(lastDay);

  return { fromDate, toDate };
}

/**
 * Get date range for calendar display (includes overflow days from adjacent months)
 * This matches what WeekStrip displays - full weeks including prev/next month days
 */
export function getMonthDisplayRange(year: number, month: number): {
  fromDate: string;
  toDate: string;
} {
  // First day of month
  const firstDay = new Date(year, month, 1);
  // Get day of week (0=Sunday, convert to Monday-based: 0=Monday)
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Go back to Monday of the first week
  const displayStart = new Date(firstDay);
  displayStart.setDate(displayStart.getDate() - startDayOfWeek);

  // Last day of month
  const lastDay = new Date(year, month + 1, 0);
  // Get day of week for last day
  let endDayOfWeek = lastDay.getDay();
  endDayOfWeek = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1;

  // Go forward to Sunday of the last week
  const displayEnd = new Date(lastDay);
  displayEnd.setDate(displayEnd.getDate() + (6 - endDayOfWeek));

  return {
    fromDate: formatDateStr(displayStart),
    toDate: formatDateStr(displayEnd),
  };
}

/**
 * Format RRule for human-readable display
 */
export function formatRRule(rruleStr: string): string {
  const weekdays = parseRRuleWeekdays(rruleStr);

  if (weekdays.length === 0) return "No days";
  if (weekdays.length === 7) return "Daily";

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Check for Mon-Fri pattern
  const isWeekdays =
    weekdays.length === 5 &&
    [0, 1, 2, 3, 4].every((d) => weekdays.includes(d)) &&
    !weekdays.includes(5) &&
    !weekdays.includes(6);
  if (isWeekdays) return "Mon-Fri";

  // Check for Sat-Sun pattern
  const isWeekend =
    weekdays.length === 2 && weekdays.includes(5) && weekdays.includes(6);
  if (isWeekend) return "Sat-Sun";

  // Return comma-separated list
  return weekdays
    .sort((a, b) => a - b)
    .map((d) => dayLabels[d])
    .join(", ");
}

// =============================================================================
// Data Extraction from ChefMeal (chef_all_meals view)
// =============================================================================

/**
 * Embedded schedule structure from chef_all_meals view
 * Note: View returns quantity_per_slot (not max_quantity_per_slot)
 * View already filters is_active=true so it's not in the JSON
 */
interface EmbeddedSchedule {
  id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;
  slot_label: string | null;
  is_public: boolean;
  // Community fields from v_schedules_with_communities
  community_list?: string[] | null;
  community_ids?: string[] | null;
  // Nested arrays
  exceptions?: EmbeddedException[];
  instances?: EmbeddedInstance[];
}

/**
 * Embedded exception from chef_all_meals view
 * Note: schedule_id is NOT included - it's implicit from parent schedule
 */
interface EmbeddedException {
  id: string;
  exception_date: string;
  is_cancelled: boolean;
  override_quantity: number | null;
  override_start_time: string | null;
  override_end_time: string | null;
  reason: string | null;
}

/**
 * Embedded instance from chef_all_meals view
 * Note: schedule_id is NOT included - it's implicit from parent schedule
 */
interface EmbeddedInstance {
  instance_date: string;
  quantity_sold: number;
}

/**
 * Meal with embedded schedules from chef_all_meals view
 */
interface MealWithEmbeddedSchedules {
  id: string;
  meal_name: string;
  schedules: unknown; // Json from Supabase
}

/**
 * Extracted calendar data from ChefMeal[]
 */
export interface ExtractedCalendarData {
  schedules: CalendarScheduleInput[];
  exceptions: ScheduleException[];
  instances: CalendarInstanceInput[];
}

/**
 * Extract calendar data from ChefMeal array (chef_all_meals view)
 *
 * The chef_all_meals view embeds schedules with nested exceptions and instances
 * as JSON. This function extracts and flattens them for calendar computation.
 *
 * @param meals - Array of meals from chef_all_meals view
 * @returns Flattened schedules, exceptions, and instances
 */
export function extractCalendarDataFromMeals(
  meals: MealWithEmbeddedSchedules[]
): ExtractedCalendarData {
  const schedules: CalendarScheduleInput[] = [];
  const exceptions: ScheduleException[] = [];
  const instances: CalendarInstanceInput[] = [];

  for (const meal of meals) {
    // Parse embedded schedules JSON
    const embeddedSchedules = parseSchedulesJson(meal.schedules);

    for (const schedule of embeddedSchedules) {
      // View already filters is_active=true, so skip check if undefined
      // Only skip if explicitly set to false
      if (schedule.is_active === false) continue;

      // Add schedule with meal info
      schedules.push({
        id: schedule.id,
        meal_id: meal.id,
        meal_name: meal.meal_name,
        rrule: schedule.rrule,
        dtstart: schedule.dtstart,
        dtend: schedule.dtend,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        quantity_per_slot: schedule.quantity_per_slot, // View returns quantity_per_slot
        slot_label: schedule.slot_label,
        is_public: schedule.is_public,
      });

      // Add exceptions from this schedule (schedule_id from parent)
      if (schedule.exceptions && Array.isArray(schedule.exceptions)) {
        for (const exc of schedule.exceptions) {
          exceptions.push({
            id: exc.id,
            schedule_id: schedule.id, // Use parent schedule ID
            exception_date: exc.exception_date,
            is_cancelled: exc.is_cancelled,
            override_quantity: exc.override_quantity,
            override_start_time: exc.override_start_time,
            override_end_time: exc.override_end_time,
            reason: exc.reason,
            created_at: "",
            updated_at: "",
          });
        }
      }

      // Add instances from this schedule (schedule_id from parent)
      if (schedule.instances && Array.isArray(schedule.instances)) {
        for (const inst of schedule.instances) {
          instances.push({
            schedule_id: schedule.id, // Use parent schedule ID
            instance_date: inst.instance_date,
            quantity_sold: inst.quantity_sold,
          });
        }
      }
    }
  }

  return { schedules, exceptions, instances };
}

/**
 * Parse schedules JSON from chef_all_meals view
 */
function parseSchedulesJson(schedulesJson: unknown): EmbeddedSchedule[] {
  if (!schedulesJson) return [];

  // If already an array, use it
  if (Array.isArray(schedulesJson)) {
    return schedulesJson as EmbeddedSchedule[];
  }

  // If string, parse it
  if (typeof schedulesJson === "string") {
    try {
      const parsed = JSON.parse(schedulesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Export formatDateStr for external use
 */
export { formatDateStr };
