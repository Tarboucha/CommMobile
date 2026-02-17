import { View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { deleteOfferingSchedule } from '@/lib/api/offerings';
import type { AvailabilitySchedule } from '@/types/offering';

function formatRRule(rrule: string): string {
  // Simple formatting for common patterns
  const parts = rrule.split(';');
  const freq = parts.find((p) => p.startsWith('FREQ='))?.replace('FREQ=', '');
  const byDay = parts.find((p) => p.startsWith('BYDAY='))?.replace('BYDAY=', '');

  if (!freq) return rrule;

  let label = freq.charAt(0) + freq.slice(1).toLowerCase();
  if (byDay) {
    label += ` (${byDay})`;
  }
  return label;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function ScheduleItem({
  schedule,
  offeringId,
  isProvider,
  onDeleted,
}: {
  schedule: AvailabilitySchedule;
  offeringId: string;
  isProvider: boolean;
  onDeleted: () => void;
}) {
  const handleDelete = () => {
    Alert.alert('Delete Schedule', 'Remove this availability schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOfferingSchedule(offeringId, schedule.id);
            onDeleted();
          } catch {
            Alert.alert('Error', 'Failed to delete schedule');
          }
        },
      },
    ]);
  };

  return (
    <View className="p-4 rounded-xl border border-border bg-card gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={16} color="#660000" />
          <Text className="text-sm font-semibold text-foreground">
            {formatRRule(schedule.rrule)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className={`px-2 py-0.5 rounded-full ${
              schedule.is_active ? 'bg-green-100' : 'bg-muted'
            }`}
          >
            <Text
              className={`text-[10px] font-medium ${
                schedule.is_active ? 'text-green-800' : 'text-muted-foreground'
              }`}
            >
              {schedule.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
          {isProvider && (
            <Pressable onPress={handleDelete} className="p-1">
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={14} color="#78716C" />
          <Text className="text-xs text-muted-foreground">
            {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="people-outline" size={14} color="#78716C" />
          <Text className="text-xs text-muted-foreground">
            {schedule.slots_available} {schedule.slot_label || 'slots'}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <Text className="text-xs text-muted-foreground">
          From {schedule.dtstart}
          {schedule.dtend ? ` to ${schedule.dtend}` : ' (ongoing)'}
        </Text>
      </View>
    </View>
  );
}

export function ScheduleList({
  offeringId,
  schedules,
  isProvider,
  onRefresh,
}: {
  offeringId: string;
  schedules: AvailabilitySchedule[];
  isProvider: boolean;
  onRefresh: () => void;
}) {
  if (schedules.length === 0) {
    return (
      <View className="py-8 items-center gap-2">
        <Ionicons name="calendar-outline" size={32} color="#78716C" />
        <Text className="text-sm text-muted-foreground">
          No availability schedules yet.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {schedules.map((schedule) => (
        <ScheduleItem
          key={schedule.id}
          schedule={schedule}
          offeringId={offeringId}
          isProvider={isProvider}
          onDeleted={onRefresh}
        />
      ))}
    </View>
  );
}
