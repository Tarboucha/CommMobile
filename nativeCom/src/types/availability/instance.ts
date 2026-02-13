/**
 * Instance Types
 * Types for schedule instances (created lazily when orders are placed)
 */

// =============================================================================
// Instance Base Types
// =============================================================================

/**
 * Instance with quantity_sold (created lazily when orders are placed)
 * From meal_availability_instances table
 */
export interface ScheduleInstance {
  id: string;
  schedule_id: string;
  instance_date: string; // "2026-01-20"
  quantity_sold: number;
  created_at: string;
  updated_at: string;
}

/**
 * Raw schedule instance from API (browse API format)
 * Uses quantity_sold - remainingQuantity is computed by merge function
 */
export interface RawScheduleInstance {
  id: string;
  schedule_id: string;
  instance_date: string;
  quantity_sold: number;
}

/**
 * Instance data from browse API response
 */
export interface BrowseApiInstance {
  id: string;
  schedule_id: string;
  instance_date: string;
  quantity_sold: number;
}

// =============================================================================
// API Query Options
// =============================================================================

/**
 * Options for fetching instances with date range filter
 */
export interface GetInstancesOptions {
  fromDate?: string;
  toDate?: string;
}
