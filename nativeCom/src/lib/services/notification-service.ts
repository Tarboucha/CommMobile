import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Configure how notifications are handled when app is in foreground
 * Updated for Expo SDK 53+ with new options
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure notification channel for Android
 * WICHTIG: Muss vor ersten Notifications aufgerufen werden
 */
export const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'KoDo Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
};

/**
 * Request notification permissions from user
 * Returns true if permissions granted
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not already granted, ask user
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowProvisional: false, // Require explicit permission
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Check if user has granted notification permissions
 */
export const checkNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    return false;
  }
};

/**
 * Generate Expo Push Token
 * Note: Push tokens only work on physical devices, not simulators/emulators
 * The getExpoPushTokenAsync call will fail gracefully on non-physical devices
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    // Get project ID from app.json (optional for development builds)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    // Generate Expo Push Token
    // projectId is optional for development builds with firebase configured
    const tokenConfig: Notifications.ExpoPushTokenOptions = {};
    if (projectId && projectId !== 'your-project-id') {
      tokenConfig.projectId = projectId;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync(tokenConfig);

    return token;
  } catch (error) {
    // This is expected on simulators/emulators
    return null;
  }
};

/**
 * Schedule a local notification (for testing)
 */
export const scheduleTestNotification = async (
  title: string,
  body: string,
  seconds: number = 5
): Promise<string> => {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      badge: 1,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
};

/**
 * Dismiss all notifications
 */
export const dismissAllNotifications = async (): Promise<void> => {
  await Notifications.dismissAllNotificationsAsync();
};
