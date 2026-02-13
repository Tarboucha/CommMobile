import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';

export interface CalendarHeaderProps {
  /** Current month/year to display */
  currentDate: Date;
  /** Navigate to previous month */
  onPrevMonth: () => void;
  /** Navigate to next month */
  onNextMonth: () => void;
  /** Optional: Number of active schedules to display */
  scheduleCount?: number;
  /** Optional: Number of slots today to display */
  todaySlotCount?: number;
  /** Optional: Hide stats row */
  hideStats?: boolean;
}

/**
 * Calendar Header Component
 * Month navigation with optional stats row
 */
export function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  scheduleCount,
  todaySlotCount,
  hideStats = false,
}: CalendarHeaderProps) {
  const monthYearStr = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const showStats = !hideStats && (scheduleCount !== undefined || todaySlotCount !== undefined);

  return (
    <View className="px-4 pt-4 pb-3">
      {/* Month Navigation Row */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={onPrevMonth}
          hitSlop={12}
          className="w-10 h-10 rounded-full items-center justify-center bg-muted active:bg-muted/70"
        >
          <Ionicons name="chevron-back" size={20} color="#1F2937" />
        </Pressable>

        <Text className="text-xl font-bold text-foreground">{monthYearStr}</Text>

        <Pressable
          onPress={onNextMonth}
          hitSlop={12}
          className="w-10 h-10 rounded-full items-center justify-center bg-muted active:bg-muted/70"
        >
          <Ionicons name="chevron-forward" size={20} color="#1F2937" />
        </Pressable>
      </View>

      {/* Stats Row (optional) */}
      {showStats && (
        <View className="flex-row items-center justify-center gap-3">
          {scheduleCount !== undefined && (
            <View className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg bg-muted">
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text className="text-xs font-medium text-muted-foreground">
                {scheduleCount} {scheduleCount === 1 ? 'Schedule' : 'Schedules'}
              </Text>
            </View>
          )}

          {todaySlotCount !== undefined && (
            <View className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg bg-muted">
              <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
              <Text className="text-xs font-medium text-muted-foreground">
                {todaySlotCount} {todaySlotCount === 1 ? 'Slot' : 'Slots'} Today
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
