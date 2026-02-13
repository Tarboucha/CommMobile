import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * ExpoPushTokenManager Component
 *
 * Manages Expo Push Token permissions request.
 * Token registration is handled by usePushNotifications hook directly.
 *
 * Flow:
 * 1. Request permissions when user logs in
 * 2. usePushNotifications hook handles token registration automatically
 */
export function ExpoPushTokenManager() {
  const user = useAuthStore((state) => state.user);
  const { hasPermission, requestPermissions } = usePushNotifications();

  // Request permissions when user logs in
  useEffect(() => {
    if (user && !hasPermission) {
      // Show permission request after short delay (better UX)
      const timer = setTimeout(() => {
        requestPermissions();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, hasPermission, requestPermissions]);

  // This component doesn't render anything
  // Token registration/removal is handled by usePushNotifications hook
  return null;
}
