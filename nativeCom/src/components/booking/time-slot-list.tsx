import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useTimeSlots } from '@/hooks/queries/use-time-slots';
import type { TimeSlot } from '@/types/offering';

interface TimeSlotListProps {
  offeringId: string;
  scheduleId: string;
  date: string | null;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot | null) => void;
}

export function TimeSlotList({
  offeringId,
  scheduleId,
  date,
  selectedSlot,
  onSelectSlot,
}: TimeSlotListProps) {
  const { data, isLoading, error } = useTimeSlots(offeringId, scheduleId, date);

  if (!date) {
    return (
      <View className="p-4 rounded-xl border border-border bg-card items-center">
        <Text className="text-sm text-muted-foreground">Select a date to see available times</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="p-6 rounded-xl border border-border bg-card items-center gap-2">
        <ActivityIndicator size="small" color="#660000" />
        <Text className="text-xs text-muted-foreground">Loading time slots...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="p-4 rounded-xl border border-destructive/30 bg-destructive/10">
        <Text className="text-sm text-destructive">Failed to load time slots</Text>
      </View>
    );
  }

  const slots = data?.slots ?? [];

  if (slots.length === 0) {
    return (
      <View className="p-4 rounded-xl border border-border bg-card items-center gap-1">
        <Ionicons name="calendar-outline" size={24} color="#9CA3AF" />
        <Text className="text-sm text-muted-foreground">No time slots available for this date</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 px-1">
        <Ionicons name="time-outline" size={16} color="#660000" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
          Pick a time
        </Text>
        <Text className="text-xs text-muted-foreground">
          ({data?.slot_duration_minutes} min each)
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot?.start_time === slot.start_time &&
            selectedSlot?.end_time === slot.end_time;
          const isDisabled = !slot.is_available;

          return (
            <Pressable
              key={slot.start_time}
              className={`px-4 py-2.5 rounded-xl border-2 ${
                isDisabled
                  ? 'bg-muted/50 border-border opacity-40'
                  : isSelected
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border'
              }`}
              onPress={() => {
                if (isDisabled) return;
                onSelectSlot(isSelected ? null : slot);
              }}
              disabled={isDisabled}
            >
              <Text
                className={`text-sm font-semibold ${
                  isDisabled
                    ? 'text-muted-foreground'
                    : isSelected
                      ? 'text-primary'
                      : 'text-foreground'
                }`}
              >
                {slot.start_time}
              </Text>
              {isDisabled && (
                <Text className="text-[10px] text-muted-foreground">Full</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
