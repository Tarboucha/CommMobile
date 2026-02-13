/**
 * Computed Types
 * Types for merged/computed availability data (Schedule + Exception + Instance)
 */

import type { RawScheduleInstance, RawScheduleException } from "./index";

// =============================================================================
// Raw API Response Types (from Supabase)
// =============================================================================

/**
 * Raw schedule data from API (nested in meal)
 * Note: Field names match the database/view schema exactly
 */
export interface RawScheduleData {
  id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number; // DB uses quantity_per_slot (not max_quantity_per_slot)
  slot_label: string | null;
  is_active: boolean;
  is_public?: boolean;
}

/**
 * Schedule data as returned by chef_all_meals view
 * Includes nested exceptions and instances arrays
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
  // Nested data from view (30-day window)
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

/**
 * Raw meal data from API
 */
export interface RawMealData {
  id: string;
  meal_name: string;
  meal_description: string | null;
  price_amount: number;
  currency_code: string;
  preparation_time_minutes: number | null;
  chef_profile_id: string;
  meal_availability_schedules: RawScheduleData[] | null;
}

// =============================================================================
// Computed Slot Types
// =============================================================================

/**
 * A single availability slot for a specific date
 * Combines schedule defaults with instance/exception overrides
 */
export interface ScheduleSlot {
  scheduleId: string;
  date: string; // "YYYY-MM-DD"

  // Times (effective = with exception override)
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"

  // Quantities
  maxQuantity: number;
  remainingQuantity: number;

  // Status
  isCancelled: boolean;
  isSoldOut: boolean;
  hasException: boolean;

  // Display
  slotLabel: string | null;
}

/**
 * Schedule with computed slots
 */
export interface ScheduleWithSlots extends RawScheduleData {
  slots: Map<string, ScheduleSlot>;
  instances: RawScheduleInstance[];
  exceptions: RawScheduleException[];
}

/**
 * Meal with full availability data
 */
export interface MealWithScheduleSlots {
  id: string;
  meal_name: string;
  meal_description: string | null;
  price_amount: number;
  currency_code: string;
  preparation_time_minutes: number | null;
  chef_profile_id: string;
  schedules: ScheduleWithSlots[];
}

// =============================================================================
// Calendar Slot Types (for chef calendar view)
// =============================================================================

/**
 * A computed calendar slot for display
 * Combines Schedule + Exception + Instance data
 */
export interface CalendarSlot {
  schedule_id: string;
  meal_id: string;
  meal_name: string;
  date: string; // "2026-01-20"
  start_time: string; // After exception override applied
  end_time: string; // After exception override applied
  quantity_available: number; // After exception override applied
  quantity_sold: number; // From instance or 0
  slot_label: string | null;
  is_public: boolean;

  // Exception info
  is_cancelled: boolean;
  has_exception: boolean;
  exception_reason: string | null;
}

/**
 * Slots grouped by date for calendar display
 */
export interface DaySlots {
  date: string; // "2026-01-20"
  slots: CalendarSlot[];
  totalAvailable: number;
  totalSold: number;
  hasCancelled: boolean;
}

/**
 * Map of date string to DaySlots for quick lookup
 */
export type CalendarSlotsMap = Map<string, DaySlots>;

// =============================================================================
// Availability Status Types
// =============================================================================

export type AvailabilityStatus =
  | "available_now"
  | "available_later"
  | "sold_out"
  | "cancelled"
  | "ended"
  | "not_scheduled"
  | "no_schedule";

export type PrimaryStatusType =
  | "available"
  | "low_stock"
  | "later_today"
  | "tomorrow"
  | "this_week"
  | "future"
  | "unavailable";

export const STATUS_COLORS: Record<PrimaryStatusType, string> = {
  available: "#10B981",
  low_stock: "#F59E0B",
  later_today: "#F59E0B",
  tomorrow: "#3B82F6",
  this_week: "#3B82F6",
  future: "#64748B",
  unavailable: "#6B7280",
};

export const STATUS_ICONS: Record<PrimaryStatusType, string> = {
  available: "checkmark-circle",
  low_stock: "alert-circle",
  later_today: "time",
  tomorrow: "calendar",
  this_week: "calendar-outline",
  future: "calendar-outline",
  unavailable: "ban",
};

// =============================================================================
// Display Context Types (for grouping and UI)
// =============================================================================

/**
 * Group type for meal grouping
 */
export type MealGroupType =
  | "featured"
  | "new"
  | "available_now"
  | "later_today"
  | "tomorrow"
  | "this_week"
  | "future"
  | "unavailable";

/**
 * Next availability information
 */
export interface NextAvailability {
  date: string;
  time: string;
  slotLabel?: string;
  isToday: boolean;
  isTomorrow: boolean;
  daysFromNow: number;
  displayText: string;
}

/**
 * Additional slot information
 */
export interface AdditionalSlot {
  slotLabel?: string;
  date?: string;
  time: string;
  displayText: string;
}

/**
 * Display context for meal cards
 */
export interface MealDisplayContext {
  primaryStatus: PrimaryStatusType;
  statusText: string;
  statusColor: string;
  statusIcon: string;
  canOrder: boolean;
  scheduleDisplay?: string;
  remainingQuantity?: number;
  nextAvailability?: NextAvailability;
  additionalSlots?: AdditionalSlot[];
}

// =============================================================================
// Display Helpers
// =============================================================================

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format time "HH:MM" or "HH:MM:SS" to 12-hour format
 */
export function formatTime12h(timeStr: string): string {
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Format date for display relative to today
 */
export function formatDateRelative(dateStr: string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dateStr + "T00:00:00");
  const daysFromNow = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysFromNow === 0) return "Today";
  if (daysFromNow === 1) return "Tomorrow";
  if (daysFromNow <= 6) return WEEKDAY_SHORT[target.getDay()];

  const day = target.getDate();
  const month = MONTH_SHORT[target.getMonth()];
  return `${WEEKDAY_SHORT[target.getDay()]}, ${month} ${day}`;
}

/**
 * Get slot availability status for display
 */
export function getSlotDisplayStatus(slot: ScheduleSlot): {
  text: string;
  color: "green" | "yellow" | "red" | "gray";
  canOrder: boolean;
} {
  if (slot.isSoldOut) {
    return { text: "Sold out", color: "red", canOrder: false };
  }

  const LOW_STOCK_THRESHOLD = 5;
  if (slot.remainingQuantity <= LOW_STOCK_THRESHOLD) {
    return {
      text: `Only ${slot.remainingQuantity} left`,
      color: "yellow",
      canOrder: true,
    };
  }

  return {
    text: `${slot.remainingQuantity} available`,
    color: "green",
    canOrder: true,
  };
}

// =============================================================================
// Browse API Options
// =============================================================================

/**
 * Options for browsing meal availability
 */
export interface BrowseAvailabilityOptions {
  daysAhead?: number;
}
