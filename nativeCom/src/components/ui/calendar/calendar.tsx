import { View } from 'react-native';
import { CalendarHeader } from './calendar-header';
import { WeekStrip } from './week-strip';

export interface CalendarProps {
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

  // Data
  /** Map of date -> event count for dot indicators */
  eventCounts?: Map<string, number>;

  // Customization
  /** Render function for selected day content */
  renderDayContent: (selectedDate: string) => React.ReactNode;

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
 * Generic calendar with month navigation, week strip, and
 * render prop for day content.
 *
 * @example
 * ```tsx
 * <Calendar
 *   selectedDate={selectedDate}
 *   onDateSelect={setSelectedDate}
 *   currentMonth={currentMonth}
 *   onMonthChange={setCurrentMonth}
 *   eventCounts={eventCounts}
 *   renderDayContent={(date) => <MyDayView date={date} />}
 * />
 * ```
 */
export function Calendar({
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  eventCounts,
  renderDayContent,
  scheduleCount,
  todaySlotCount,
  hideStats,
}: CalendarProps) {
  // Navigation handlers
  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);

    if (minDate) {
      const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      if (prevMonth < minMonthStart) return;
    }

    onMonthChange(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

    if (maxDate) {
      const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      if (nextMonth > maxMonthStart) return;
    }

    onMonthChange(nextMonth);
  };

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
        eventCounts={eventCounts}
        onDaySelect={onDateSelect}
      />

      {/* Day Content (provided via render prop) */}
      {renderDayContent(selectedDate)}
    </View>
  );
}
