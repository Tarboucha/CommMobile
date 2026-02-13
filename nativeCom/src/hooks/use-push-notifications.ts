import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { Notification } from 'expo-notifications';
import {
  requestNotificationPermissions,
  registerForPushNotifications,
  checkNotificationPermissions,
  setupNotificationChannels,
} from '@/lib/services/notification-service';
import { registerPushToken, deletePushToken } from '@/lib/api/push-tokens';
import { useAuthStore } from '@/lib/stores/auth-store';
import { handleError } from '@/lib/services/error-service';
import type { PushNotificationData } from '@/types/notification';

interface UsePushNotificationsReturn {
  expoPushToken: string | null;
  isLoading: boolean;
  hasPermission: boolean;
  lastNotification: Notification | null;
  requestPermissions: () => Promise<boolean>;
  unregisterToken: () => Promise<void>;
}

/**
 * Hook for managing Expo Push Notifications
 * Uses modern Expo SDK 53+ patterns including useLastNotificationResponse
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);
  const [isTokenRegistered, setIsTokenRegistered] = useState(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  // Use Expo's recommended hook for notification responses (taps)
  // This handles cold start and background scenarios correctly
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  // Register token with server when user is logged in and token is available
  useEffect(() => {
    const syncTokenWithServer = async () => {
      if (!expoPushToken || !user || isTokenRegistered) return;

      try {
        await registerPushToken(expoPushToken);
        setIsTokenRegistered(true);
      } catch (error) {
        handleError(error, { severity: 'silent', screen: 'push-notifications' });
      }
    };

    syncTokenWithServer();
  }, [expoPushToken, user, isTokenRegistered]);

  // Handle notification taps using the recommended hook
  useEffect(() => {
    if (!lastNotificationResponse) return;

    const data = lastNotificationResponse.notification.request.content.data as PushNotificationData;

    // Navigate based on notification type
    switch (data.type) {
      case 'order_placed':
      case 'order_confirmed':
      case 'order_status_update':
      case 'order_ready':
      case 'order_delivered':
        if (data.order_id) {
          router.push(`/account/shared/orders/${data.order_id}`);
        }
        break;

      case 'new_review':
      case 'payment_received':
      case 'new_meal_available':
      case 'promotion':
      case 'system':
        router.push('/account/notifications');
        break;

      default:
        router.push('/account/notifications');
    }
  }, [lastNotificationResponse, router]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Setup Android notification channels FIRST (required before token generation)
        await setupNotificationChannels();

        // Check existing permissions
        const hasPerms = await checkNotificationPermissions();
        setHasPermission(hasPerms);

        // If permissions granted, register for push
        if (hasPerms) {
          const token = await registerForPushNotifications();
          if (token) {
            setExpoPushToken(token);
          }
        }
      } catch (error) {
        handleError(error, { severity: 'silent', screen: 'push-notifications' });
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Listen for notifications received while app is in FOREGROUND
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notification) => {
        setLastNotification(notification);
        // Note: Socket.io already handles foreground notifications with Toast
        // This listener is for backup/logging
      }
    );

    // Cleanup listener on unmount
    return () => {
      notificationListener.current?.remove();
    };
  }, []);

  /**
   * Request permissions from user
   */
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const granted = await requestNotificationPermissions();
      setHasPermission(granted);

      if (granted) {
        const token = await registerForPushNotifications();
        if (token) {
          setExpoPushToken(token);
        }
      }

      return granted;
    } catch (error) {
      handleError(error, { severity: 'silent', screen: 'push-notifications' });
      return false;
    }
  };

  /**
   * Unregister token from server (call on logout)
   */
  const unregisterToken = useCallback(async (): Promise<void> => {
    if (!expoPushToken) return;

    try {
      await deletePushToken(expoPushToken);
      setIsTokenRegistered(false);
    } catch (error) {
      handleError(error, { severity: 'silent', screen: 'push-notifications' });
    }
  }, [expoPushToken]);

  return {
    expoPushToken,
    isLoading,
    hasPermission,
    lastNotification,
    requestPermissions,
    unregisterToken,
  };
}
