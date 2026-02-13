/**
 * Availability Types
 * Re-exports all availability-related types
 */

// Schedule types
export type {
  ScheduleCommunity,
  MealSchedule,
  MealScheduleWithCommunities,
  MealAvailabilitySchedule,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleInput,
  ScheduleUpdateInput,
  RRuleWeekday,
} from "./schedule";

export {
  RRULE_WEEKDAYS,
  WEEKDAY_LABELS,
  WEEKDAY_LABELS_FULL,
  buildWeeklyRRule,
  parseRRuleWeekdays,
  formatRRule,
} from "./schedule";

// Exception types
export type {
  ScheduleException,
  RawScheduleException,
  UpsertExceptionRequest,
  GetExceptionsOptions,
} from "./exception";

// Instance types
export type {
  ScheduleInstance,
  RawScheduleInstance,
  BrowseApiInstance,
  GetInstancesOptions,
} from "./instance";

// Computed types
export type {
  RawScheduleData,
  RawMealData,
  ViewScheduleData,
  ScheduleSlot,
  ScheduleWithSlots,
  MealWithScheduleSlots,
  CalendarSlot,
  DaySlots,
  CalendarSlotsMap,
  AvailabilityStatus,
  PrimaryStatusType,
  MealGroupType,
  NextAvailability,
  AdditionalSlot,
  MealDisplayContext,
  BrowseAvailabilityOptions,
} from "./computed";

export {
  STATUS_COLORS,
  STATUS_ICONS,
  WEEKDAY_SHORT,
  MONTH_SHORT,
  formatTime12h,
  formatDateRelative,
  getSlotDisplayStatus,
} from "./computed";
