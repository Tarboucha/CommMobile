import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { NotificationCard } from './notification-card';
import { EmptyNotificationsState } from './empty-notifications-state';
import { cn } from '@/lib/utils';
import {
  getNotifications,
  markNotificationAsRead,
  dismissAllNotifications,
  deleteAllNotifications,
} from '@/lib/api/notifications';
import type { Notification } from '@/types/notification';
import { handleError } from '@/lib/services/error-service';

type TabType = 'all' | 'unread';

/**
 * Notifications Screen
 * Main screen for viewing and managing notifications
 */
export function NotificationsScreen() {
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Load notifications from API
   */
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = activeTab === 'unread' ? { is_read: false } : undefined;
      const response = await getNotifications(params);

      setNotifications(response.data);
      setUnreadCount(response.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /**
   * Reload notifications when screen comes into focus
   */
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  /**
   * Handle notification press
   */
  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      // Mark as read if unread
      if (!notification.is_read) {
        try {
          await markNotificationAsRead(notification.id);
          // Optimistic update
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
          handleError(err, { severity: 'silent', screen: 'notifications' });
        }
      }

      // Navigate based on notification type
      const dataJson = notification.data_json as Record<string, string> | null;

      if (
        notification.notification_type === 'community_invite' &&
        dataJson?.invitation_id &&
        dataJson?.community_id
      ) {
        router.push(
          `/community/${dataJson.community_id}/invitation?invitationId=${dataJson.invitation_id}`
        );
        return;
      }

      // Fallback: navigate based on related entity
      if (notification.related_community_id) {
        router.push(`/community/${notification.related_community_id}`);
      } else if (notification.related_booking_id) {
        router.push({
          pathname: '/booking/[bookingId]',
          params: { bookingId: notification.related_booking_id },
        });
      } else if (notification.related_offering_id) {
        router.push(`/account/shared/offerings/${notification.related_offering_id}`);
      }
    },
    []
  );

  /**
   * Handle dismiss all
   */
  const handleDismissAll = useCallback(async () => {
    if (unreadCount === 0) return;

    Alert.alert(
      'Mark all as read',
      'Are you sure you want to mark all notifications as read?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Mark all',
          onPress: async () => {
            try {
              await dismissAllNotifications();
              await loadNotifications();
              Alert.alert('Success', 'All notifications marked as read');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark all as read');
            }
          },
        },
      ]
    );
  }, [unreadCount, loadNotifications]);

  /**
   * Handle delete all
   */
  const handleDeleteAll = useCallback(async () => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Delete all notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllNotifications();
              setNotifications([]);
              setUnreadCount(0);
              Alert.alert('Success', 'All notifications deleted');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete all notifications');
            }
          },
        },
      ]
    );
  }, [notifications.length]);

  /**
   * Render tab button
   */
  const renderTab = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;

    return (
      <Pressable
        className={cn(
          'flex-1 flex-row justify-center items-center gap-1 py-4 border-b-2',
          isActive ? 'border-primary' : 'border-transparent'
        )}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          className={cn(
            'text-base font-medium',
            isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
          )}
        >
          {label}
        </Text>
        {tab === 'unread' && unreadCount > 0 && (
          <View className="px-1 py-0.5 rounded-full bg-destructive min-w-[20px] h-5 justify-center items-center">
            <Text className="text-xs font-semibold text-destructive-foreground">
              {unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  /**
   * Render header
   */
  const renderHeader = () => (
    <View className="mb-6">
      {/* Tabs */}
      <View className="flex-row border-b border-border mb-4">
        {renderTab('all', 'All')}
        {renderTab('unread', 'Unread')}
      </View>

      {/* Actions */}
      {notifications.length > 0 && (
        <View className="flex-row gap-2 mb-4">
          {unreadCount > 0 && (
            <Pressable
              className="flex-row items-center gap-1 py-2 px-4 rounded-lg bg-muted"
              onPress={handleDismissAll}
            >
              <Ionicons name="checkmark-done" size={16} color="#1F2937" />
              <Text className="text-sm font-medium">
                Mark all as read
              </Text>
            </Pressable>
          )}
          <Pressable
            className="flex-row items-center gap-1 py-2 px-4 rounded-lg bg-muted"
            onPress={handleDeleteAll}
          >
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
            <Text className="text-sm font-medium text-destructive">
              Delete all
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  /**
   * Loading state
   */
  if (isLoading && !isRefreshing && notifications.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen
          options={{
            title: 'Notifications',
          }}
        />
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator size="large" color="#660000" />
          <Text className="text-base">Loading notifications...</Text>
        </View>
      </View>
    );
  }

  /**
   * Error state
   */
  if (error && !isLoading && notifications.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen
          options={{
            title: 'Notifications',
          }}
        />
        <View className="flex-1 justify-center items-center gap-4 px-6">
          <Ionicons name="alert-circle" size={64} color="#DC2626" />
          <Text className="text-xl font-semibold">
            Error
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {error}
          </Text>
          <Pressable
            className="py-4 px-8 rounded-lg bg-primary mt-4"
            onPress={loadNotifications}
          >
            <Text className="text-base font-semibold text-primary-foreground">
              Retry
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /**
   * Main content
   */
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Notifications',
        }}
      />
      <FlatList
        data={notifications}
        renderItem={({ item }) => (
          <NotificationCard notification={item} onPress={handleNotificationPress} />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyNotificationsState isUnreadFilter={activeTab === 'unread'} />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#660000"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
