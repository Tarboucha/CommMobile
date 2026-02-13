import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

interface EmptyNotificationsStateProps {
  isUnreadFilter?: boolean;
}

/**
 * Empty Notifications State
 * Displays a friendly message when there are no notifications
 */
export function EmptyNotificationsState({ isUnreadFilter = false }: EmptyNotificationsStateProps) {
  return (
    <View className="flex-1 justify-center items-center px-8 py-24">
      <Ionicons
        name="notifications-off-outline"
        size={64}
        color="#6B7280"
        style={{ marginBottom: 24, opacity: 0.5 }}
      />
      <Text className="text-xl font-semibold mb-2 text-center">
        {isUnreadFilter ? 'All caught up!' : 'No notifications yet'}
      </Text>
      <Text className="text-sm text-center text-muted-foreground leading-5">
        {isUnreadFilter
          ? 'You have no unread notifications'
          : "You'll see updates about your orders and activity here"}
      </Text>
    </View>
  );
}
