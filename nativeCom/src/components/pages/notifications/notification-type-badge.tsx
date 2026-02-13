import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { getNotificationTypeConfig } from '@/lib/constants/notification-types';
interface NotificationTypeBadgeProps {
  type: string;
}

/**
 * Notification Type Badge
 * Displays a colored badge with 2-letter abbreviation for notification type
 */
export function NotificationTypeBadge({ type }: NotificationTypeBadgeProps) {
  const config = getNotificationTypeConfig(type);

  return (
    <View
      className="w-10 h-10 rounded-lg justify-center items-center"
      style={{
        backgroundColor: config.backgroundColor,
        borderColor: config.color,
        borderWidth: 1.5,
      }}
    >
      <Text
        className="text-xs font-bold tracking-wide"
        style={{ color: config.color }}
      >
        {config.badgeText}
      </Text>
    </View>
  );
}
