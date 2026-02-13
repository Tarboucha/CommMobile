/**
 * Exception Types
 * Types for schedule exceptions (day overrides)
 */

// =============================================================================
// Exception Base Types
// =============================================================================

/**
 * Schedule exception for a specific date
 * From meal_schedule_exceptions table
 */
export interface ScheduleException {
  id: string;
  schedule_id: string;
  exception_date: string; // "2026-01-20"
  is_cancelled: boolean;
  override_quantity: number | null;
  override_start_time: string | null;
  override_end_time: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Raw schedule exception from API (browse API format)
 * Uses override_quantity (same as API) - not override_max_quantity
 */
export interface RawScheduleException {
  id: string;
  schedule_id: string;
  exception_date: string;
  is_cancelled: boolean;
  override_start_time: string | null;
  override_end_time: string | null;
  override_quantity: number | null;
  reason?: string | null;
}

// =============================================================================
// Exception Input Types
// =============================================================================

/**
 * Request for POST /api/meals/[mealId]/schedules/[scheduleId]/exceptions (UPSERT)
 */
export interface UpsertExceptionRequest {
  exception_date: string;
  is_cancelled?: boolean;
  override_quantity?: number | null;
  override_start_time?: string | null;
  override_end_time?: string | null;
  reason?: string | null;
}

// =============================================================================
// API Query Options
// =============================================================================

/**
 * Options for fetching exceptions with date range filter
 */
export interface GetExceptionsOptions {
  fromDate?: string;
  toDate?: string;
}
