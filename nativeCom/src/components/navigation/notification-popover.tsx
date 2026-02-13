import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { NotificationCard } from '@/components/pages/notifications/notification-card';
import { getNotifications, dismissAllNotifications } from '@/lib/api/notifications';
import type { Notification } from '@/types/notification';

interface NotificationPopoverProps {
  isVisible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

/**
 * Notification Popover Modal
 * Shows top 5 most recent notifications with actions
 */
export function NotificationPopover({
  isVisible,
  onClose,
  onUnreadCountChange,
}: NotificationPopoverProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch top 5 notifications
   */
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getNotifications({ limit: 5 });
      setNotifications(response.notifications);
      onUnreadCountChange?.(response.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange]);

  /**
   * Load notifications when popover becomes visible
   */
  useEffect(() => {
    if (isVisible) {
      loadNotifications();
    }
  }, [isVisible, loadNotifications]);

  /**
   * Handle mark all as read
   */
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await dismissAllNotifications();
      await loadNotifications();
    } catch {
      // Silent fail for mark-all-as-read
    }
  }, [loadNotifications]);

  /**
   * Handle notification press
   */
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      // Close popover first
      onClose();

      // Navigate based on notification type
      if (notification.related_order_id) {
        router.push(`/account/shared/orders/${notification.related_order_id}`);
      }
    },
    [onClose]
  );

  /**
   * Handle "View All" button
   */
  const handleViewAll = useCallback(() => {
    onClose();
    router.push('/account/notifications');
  }, [onClose]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="h-[70%]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-1 bg-background rounded-t-2xl overflow-hidden">
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 py-4 border-b border-border">
              <Text className="text-xl font-semibold">Notifications</Text>
              <Pressable
                className="p-2 min-w-[44px] min-h-[44px] justify-center items-center"
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </Pressable>
            </View>

            {/* Mark All as Read Button */}
            {notifications.some((n) => !n.is_dismissed) && (
              <View className="px-6 py-4">
                <Pressable
                  className="flex-row items-center gap-2 py-3 px-4 rounded-lg bg-muted self-start min-h-[44px]"
                  onPress={handleMarkAllAsRead}
                >
                  <Ionicons name="checkmark-done" size={16} color="#1F2937" />
                  <Text className="text-sm font-medium">Mark all as read</Text>
                </Pressable>
              </View>
            )}

            {/* Content */}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {isLoading && notifications.length === 0 ? (
                <View className="flex-1 justify-center items-center gap-4 py-10 min-h-[200px]">
                  <ActivityIndicator size="large" color="#660000" />
                  <Text className="text-sm">Loading...</Text>
                </View>
              ) : error && notifications.length === 0 ? (
                <View className="flex-1 justify-center items-center gap-4 py-10 min-h-[200px]">
                  <Ionicons name="alert-circle" size={48} color="#DC2626" />
                  <Text className="text-sm text-center">{error}</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View className="flex-1 justify-center items-center gap-4 py-10 min-h-[200px]">
                  <Ionicons name="notifications-off-outline" size={48} color="#6B7280" />
                  <Text className="text-sm">No notifications</Text>
                </View>
              ) : (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
                    compact
                  />
                ))
              )}
            </ScrollView>

            {/* Footer */}
            <View className="px-6 py-4 border-t border-border">
              <Pressable
                className="py-4 px-6 rounded-lg border border-border bg-card items-center min-h-[44px] justify-center"
                onPress={handleViewAll}
              >
                <Text className="text-base font-semibold">
                  View All Notifications
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
