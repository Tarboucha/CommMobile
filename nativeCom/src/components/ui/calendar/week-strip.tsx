import { useRef, useEffect } from 'react';
import { View, Pressable, ScrollView, Dimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import type { CalendarSlotsMap } from '@/types/availability';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface WeekStripProps {
  /** Current month to display */
  currentDate: Date;
  /** Selected date (YYYY-MM-DD) */
  selectedDate: string;
  /** Map of date -> slot data for indicators */
  slotsByDate: CalendarSlotsMap;
  /** Called when user selects a day */
  onDaySelect: (date: string) => void;
}

type DayStatus = 'available' | 'partial' | 'soldOut' | null;

/**
 * Week Strip Component
 * Horizontal scrollable week view with slot indicators
 */
export function WeekStrip({
  currentDate,
  selectedDate,
  slotsByDate,
  onDaySelect,
}: WeekStripProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Get all weeks for the current month
  const getWeeksInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    let startDayOfWeek = firstDayOfMonth.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      date: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const date = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date, day, isCurrentMonth: false, isToday: false });
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday =
        today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      days.push({ date, day, isCurrentMonth: true, isToday });
    }

    // Next month days to fill last week
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let day = 1; day <= remainingDays; day++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const date = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ date, day, isCurrentMonth: false, isToday: false });
      }
    }

    // Split into weeks
    const weeks: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  };

  // Get status indicator for a day
  const getDayStatus = (date: string): DayStatus => {
    const dayData = slotsByDate.get(date);
    if (!dayData || dayData.slots.length === 0) {
      return null;
    }

    if (dayData.hasCancelled && dayData.slots.every((s) => s.is_cancelled)) {
      return 'soldOut';
    }

    const { totalAvailable, totalSold } = dayData;
    if (totalSold === 0) {
      return 'available';
    } else if (totalSold >= totalAvailable) {
      return 'soldOut';
    } else {
      return 'partial';
    }
  };

  const weeks = getWeeksInMonth();

  const selectedWeekIndex = weeks.findIndex((week) =>
    week.some((day) => day.date === selectedDate)
  );

  // Scroll to selected week
  useEffect(() => {
    if (scrollRef.current && selectedWeekIndex >= 0) {
      const scrollX = selectedWeekIndex * SCREEN_WIDTH;
      scrollRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [selectedWeekIndex, currentDate]);

  return (
    <View className="mb-4">
      {/* Weekday Headers */}
      <View className="flex-row px-4 mb-2">
        {WEEKDAY_NAMES.map((name) => (
          <View key={name} style={{ width: DAY_WIDTH }} className="items-center">
            <Text className="text-xs font-semibold text-muted-foreground">{name}</Text>
          </View>
        ))}
      </View>

      {/* Scrollable Weeks */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
      >
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={{ width: SCREEN_WIDTH }} className="flex-row px-4">
            {week.map((dayInfo) => {
              const isSelected = dayInfo.date === selectedDate;
              const status = getDayStatus(dayInfo.date);
              const slotCount = slotsByDate.get(dayInfo.date)?.slots.length || 0;

              return (
                <Pressable
                  key={dayInfo.date}
                  style={{ width: DAY_WIDTH }}
                  className="items-center py-2"
                  onPress={() => onDaySelect(dayInfo.date)}
                >
                  {/* Day Number */}
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mb-1 ${
                      isSelected
                        ? 'bg-primary'
                        : dayInfo.isToday
                          ? 'bg-primary/10 border-2 border-primary'
                          : ''
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        isSelected
                          ? 'text-primary-foreground'
                          : dayInfo.isCurrentMonth
                            ? dayInfo.isToday
                              ? 'text-primary'
                              : 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {dayInfo.day}
                    </Text>
                  </View>

                  {/* Slot Indicators */}
                  <View className="flex-row items-center gap-0.5 h-3">
                    {slotCount > 0 && (
                      <>
                        <View
                          className={`w-2 h-2 rounded-full ${
                            status === 'available'
                              ? 'bg-emerald-500'
                              : status === 'partial'
                                ? 'bg-amber-500'
                                : status === 'soldOut'
                                  ? 'bg-red-500'
                                  : 'bg-gray-400'
                          }`}
                        />
                        {slotCount > 1 && (
                          <View
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'available'
                                ? 'bg-emerald-400'
                                : status === 'partial'
                                  ? 'bg-amber-400'
                                  : status === 'soldOut'
                                    ? 'bg-red-400'
                                    : 'bg-gray-300'
                            }`}
                          />
                        )}
                        {slotCount > 2 && (
                          <View
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'available'
                                ? 'bg-emerald-300'
                                : status === 'partial'
                                  ? 'bg-amber-300'
                                  : status === 'soldOut'
                                    ? 'bg-red-300'
                                    : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Week Indicator Dots */}
      <View className="flex-row justify-center gap-1.5 mt-2">
        {weeks.map((_, index) => (
          <View
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              index === selectedWeekIndex ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </View>
    </View>
  );
}
