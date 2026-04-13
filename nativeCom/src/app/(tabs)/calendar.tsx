import { useMemo, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDayBookings } from '@/components/pages/calendar/calendar-day-bookings';
import { useCalendarBookings } from '@/hooks/queries/use-calendar-bookings';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data, isLoading } = useCalendarBookings(currentMonth);

  // Convert event_counts from Record to Map for Calendar component
  const eventCounts = useMemo(() => {
    if (!data?.event_counts) return undefined;
    const map = new Map<string, number>();
    for (const [date, count] of Object.entries(data.event_counts)) {
      map.set(date, count);
    }
    return map;
  }, [data?.event_counts]);

  // Get entries for selected date
  const dayEntries = data?.dates?.[selectedDate] ?? [];

  // Count for header
  const todayStr = getTodayString();
  const todayCount = data?.event_counts?.[todayStr] ?? 0;

  return (
    <View className="flex-1 bg-background">
      <Calendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        eventCounts={eventCounts}
        todaySlotCount={todayCount}
        renderDayContent={() =>
          isLoading ? (
            <View className="flex-1 items-center justify-center p-6">
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <CalendarDayBookings entries={dayEntries} selectedDate={selectedDate} />
          )
        }
      />
    </View>
  );
}
