import { useState, useEffect, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { NotificationPopover } from './notification-popover';
import { getUnreadCount } from '@/lib/api/notifications';
import { useSocket } from '@/contexts/socket-context';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Notification Bell Button
 * Displays bell icon with unread count badge in header
 *
 * Badge Count Strategy (Modern Best Practice):
 * - Primary: Real-time updates from Socket.io (server-calculated)
 * - Fallback: API call on mount and screen focus (for initial load & sync)
 * - Server is always "source of truth"
 */
export function NotificationBellButton() {
  const { badgeCount, setBadgeCount } = useSocket();
  const user = useAuthStore((state) => state.user);

  const [isLoading, setIsLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  /**
   * Fetch unread count from API
   * Used for initial load and periodic sync (fallback to Socket.io)
   * Only runs when user is authenticated
   */
  const fetchUnreadCount = useCallback(async () => {
    // Skip if user is not authenticated
    if (!user) {
      setBadgeCount(0);
      return;
    }

    try {
      setIsLoading(true);
      const count = await getUnreadCount();
      setBadgeCount(count);  // Update global badge count from SocketContext
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  }, [user, setBadgeCount]);

  /**
   * Fetch on mount and when user changes
   */
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  /**
   * Refresh when screen comes into focus (only if authenticated)
   */
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUnreadCount();
      }
    }, [user, fetchUnreadCount])
  );

  /**
   * Open notification popover (only if authenticated)
   */
  const handlePress = () => {
    if (!user) return;
    setIsPopoverOpen(true);
  };

  /**
   * Close notification popover
   */
  const handleClosePopover = () => {
    setIsPopoverOpen(false);
  };

  /**
   * Handle unread count change from popover
   * When user marks notifications as read/dismissed
   */
  const handleUnreadCountChange = useCallback((count: number) => {
    setBadgeCount(count);  // Update global badge count
  }, [setBadgeCount]);

  return (
    <>
      <Pressable className="relative p-2" onPress={handlePress}>
        <Ionicons
          name={badgeCount > 0 ? 'notifications' : 'notifications-outline'}
          size={24}
          color="#1F2937"
        />
        {badgeCount > 0 && (
          <View className="absolute top-0 right-2">
            <Text className="text-xs font-bold text-primary">
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </Pressable>

      <NotificationPopover
        isVisible={isPopoverOpen}
        onClose={handleClosePopover}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </>
  );
}
