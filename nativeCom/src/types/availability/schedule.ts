/**
 * Schedule Types
 * Types for meal availability schedules
 */

// =============================================================================
// Community Reference
// =============================================================================

/**
 * Community reference in schedule
 */
export interface ScheduleCommunity {
  community_id: string;
  community_name: string;
}

// =============================================================================
// Schedule Base Types
// =============================================================================

/**
 * Base schedule from meal_availability_schedules table
 */
export interface MealSchedule {
  id: string;
  meal_id: string;
  rrule: string; // "FREQ=WEEKLY;BYDAY=MO,TU,WE"
  dtstart: string; // "2026-01-15"
  dtend: string | null; // "2026-12-31" or null
  start_time: string; // "11:00:00"
  end_time: string; // "14:00:00"
  quantity_per_slot: number;
  slot_label: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Schedule with joined community data
 * Response from GET /api/meals/[mealId]/schedules
 */
export interface MealScheduleWithCommunities extends MealSchedule {
  communities: ScheduleCommunity[];
}

/**
 * Meal availability schedule (alias for MealSchedule with optional communities)
 * Used in browse API responses
 * Note: Field names match the database schema (quantity_per_slot)
 */
export interface MealAvailabilitySchedule {
  id: string;
  meal_id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number; // DB field name (was incorrectly max_quantity_per_slot)
  slot_label: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  communities?: ScheduleCommunity[];
}

// =============================================================================
// Schedule Input Types (for create/update)
// =============================================================================

/**
 * Request for POST /api/meals/[mealId]/schedules
 */
export interface CreateScheduleRequest {
  rrule: string;
  dtstart: string;
  dtend?: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;
  slot_label?: string | null;
  is_active?: boolean;
  is_public: boolean;
  community_ids?: string[];
}

/**
 * Request for PATCH /api/meals/[mealId]/schedules/[scheduleId]
 */
export interface UpdateScheduleRequest {
  rrule?: string;
  dtstart?: string;
  dtend?: string | null;
  start_time?: string;
  end_time?: string;
  quantity_per_slot?: number;
  slot_label?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  community_ids?: string[];
}

/**
 * Schedule input (alias for CreateScheduleRequest)
 */
export interface ScheduleInput {
  rrule: string;
  dtstart: string;
  dtend?: string | null;
  start_time: string;
  end_time: string;
  quantity_per_slot: number;
  slot_label?: string | null;
  is_active?: boolean;
  is_public: boolean;
  community_ids?: string[];
}

/**
 * Schedule update input (alias for UpdateScheduleRequest)
 */
export interface ScheduleUpdateInput {
  rrule?: string;
  dtstart?: string;
  dtend?: string | null;
  start_time?: string;
  end_time?: string;
  quantity_per_slot?: number;
  slot_label?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  community_ids?: string[];
}

// =============================================================================
// RRule Helpers
// =============================================================================

export const RRULE_WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type RRuleWeekday = (typeof RRULE_WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<RRuleWeekday, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

export const WEEKDAY_LABELS_FULL: Record<RRuleWeekday, string> = {
  MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday",
  FR: "Friday", SA: "Saturday", SU: "Sunday",
};

export function buildWeeklyRRule(days: RRuleWeekday[]): string {
  if (days.length === 0) throw new Error("At least one day must be selected");
  return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
}

export function parseRRuleWeekdays(rruleStr: string): RRuleWeekday[] {
  const match = rruleStr.match(/BYDAY=([A-Z,]+)/i);
  if (!match) return [];
  return match[1].split(",").filter((d): d is RRuleWeekday =>
    RRULE_WEEKDAYS.includes(d.toUpperCase() as RRuleWeekday)
  );
}

export function formatRRule(rruleStr: string): string {
  const days = parseRRuleWeekdays(rruleStr);
  if (days.length === 0) return "No days";
  if (days.length === 7) return "Daily";

  const weekdays: RRuleWeekday[] = ["MO", "TU", "WE", "TH", "FR"];
  if (days.length === 5 && weekdays.every(d => days.includes(d)) && !days.includes("SA") && !days.includes("SU")) {
    return "Mon-Fri";
  }
  if (days.length === 2 && days.includes("SA") && days.includes("SU")) {
    return "Sat-Sun";
  }
  return days.map(d => WEEKDAY_LABELS[d]).join(", ");
}
