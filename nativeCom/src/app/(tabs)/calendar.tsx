import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-background justify-center items-center p-6">
      <Ionicons name="calendar-outline" size={48} color="#78716C" />
      <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
        Calendar
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        Your events and schedules across all communities will appear here.
      </Text>
    </View>
  );
}
