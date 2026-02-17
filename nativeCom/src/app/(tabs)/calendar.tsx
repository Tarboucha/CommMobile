import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Calendar } from '@/components/ui/calendar';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  return (
    <View className="flex-1 bg-background">
      <Calendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        hideStats
        renderDayContent={() => (
          <View className="flex-1 items-center justify-center p-6">
            <Ionicons name="calendar-outline" size={48} color="#78716C" />
            <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
              No Events
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Your events and schedules across all communities will appear here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}
