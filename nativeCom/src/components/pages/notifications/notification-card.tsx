import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { NotificationTypeBadge } from './notification-type-badge';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/time-ago';
import type { Notification } from '@/types/notification';

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  compact?: boolean;
}

/**
 * Notification Card
 * Displays a single notification with type badge, title, body, and timestamp
 */
export function NotificationCard({ notification, onPress, compact = false }: NotificationCardProps) {
  const isUnread = !notification.is_read;
  const timeAgo = notification.created_at ? formatTimeAgo(notification.created_at) : '';

  return (
    <Pressable
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        compact ? 'mb-2' : 'mb-4',
        isUnread && 'border-l-primary'
      )}
      style={{ borderLeftWidth: isUnread ? 3 : 1 }}
      onPress={() => onPress(notification)}
    >
      <View className={cn(
        'flex-row',
        compact ? 'p-2 gap-2' : 'p-4 gap-4'
      )}>
        {/* Type Badge */}
        <NotificationTypeBadge type={notification.notification_type} />

        {/* Main Content */}
        <View className="flex-1 gap-1 relative">
          {/* Title and Time */}
          <View className="flex-row justify-between items-start gap-2">
            <Text
              className={cn(
                'flex-1 text-base font-semibold leading-[22px]',
                isUnread && 'font-bold'
              )}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {timeAgo}
            </Text>
          </View>

          {/* Body */}
          {notification.body && (
            <Text
              className="text-sm text-muted-foreground leading-5"
              numberOfLines={2}
            >
              {notification.body}
            </Text>
          )}

          {/* Unread Indicator Dot */}
          {isUnread && (
            <View className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary" />
          )}
        </View>
      </View>
    </Pressable>
  );
}
