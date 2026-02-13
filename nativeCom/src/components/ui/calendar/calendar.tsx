import { View } from 'react-native';
import { CalendarHeader } from './calendar-header';
import { WeekStrip } from './week-strip';
import type { CalendarSlotsMap, DaySlots } from '@/types/availability';

export interface CalendarProps {
  // Data
  /** Map of date -> slot data */
  slotsMap: CalendarSlotsMap;

  // State
  /** Currently selected date (YYYY-MM-DD) */
  selectedDate: string;
  /** Called when user selects a date */
  onDateSelect: (date: string) => void;

  // Navigation
  /** Current month being displayed */
  currentMonth: Date;
  /** Called when month changes */
  onMonthChange: (date: Date) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;

  // Customization
  /** Render function for day content (slots list, etc.) */
  renderDayContent: (dayData: DaySlots | null, selectedDate: string) => React.ReactNode;

  // Optional header stats
  /** Number of schedules to show in header */
  scheduleCount?: number;
  /** Number of slots today to show in header */
  todaySlotCount?: number;
  /** Hide header stats */
  hideStats?: boolean;
}

/**
 * Calendar Component
 *
 * Flexible calendar container that can be used for:
 * - Chef calendar (managing schedules)
 * - Browse date picker (selecting pickup time)
 * - Any calendar-based feature
 *
 * Uses render prop pattern for day content customization.
 *
 * @example
 * ```tsx
 * <Calendar
 *   slotsMap={slotsMap}
 *   selectedDate={selectedDate}
 *   onDateSelect={setSelectedDate}
 *   currentMonth={currentMonth}
 *   onMonthChange={setCurrentMonth}
 *   renderDayContent={(dayData, date) => (
 *     <DaySlotsPicker
 *       dayData={dayData}
 *       selectedDate={date}
 *       selectedSlot={selectedSlot}
 *       onSlotSelect={setSelectedSlot}
 *     />
 *   )}
 * />
 * ```
 */
export function Calendar({
  slotsMap,
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  renderDayContent,
  scheduleCount,
  todaySlotCount,
  hideStats,
}: CalendarProps) {
  // Navigation handlers
  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);

    // Check min date
    if (minDate) {
      const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      if (prevMonth < minMonthStart) return;
    }

    onMonthChange(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

    // Check max date
    if (maxDate) {
      const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      if (nextMonth > maxMonthStart) return;
    }

    onMonthChange(nextMonth);
  };

  // Get data for selected day
  const selectedDayData = slotsMap.get(selectedDate) || null;

  return (
    <View className="flex-1">
      {/* Month Navigation Header */}
      <CalendarHeader
        currentDate={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        scheduleCount={scheduleCount}
        todaySlotCount={todaySlotCount}
        hideStats={hideStats}
      />

      {/* Week Strip */}
      <WeekStrip
        currentDate={currentMonth}
        selectedDate={selectedDate}
        slotsByDate={slotsMap}
        onDaySelect={onDateSelect}
      />

      {/* Day Content (provided via render prop) */}
      {renderDayContent(selectedDayData, selectedDate)}
    </View>
  );
}
