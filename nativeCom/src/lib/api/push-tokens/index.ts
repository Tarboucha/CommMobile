import { fetchAPI } from '@/lib/api/client';
import { Platform } from 'react-native';

/**
 * Push Tokens API Client
 * Handles push token registration and deletion
 */

interface PushTokenResponse {
  message: string;
}

/**
 * Register a push token for the authenticated user
 * @param token Expo Push Token
 * @returns Promise with success message
 */
export async function registerPushToken(token: string): Promise<void> {
  const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

  await fetchAPI<{ success: boolean; data: PushTokenResponse }>(
    '/api/push-tokens',
    {
      method: 'POST',
      body: JSON.stringify({
        token,
        device_type: deviceType,
      }),
    }
  );
}

/**
 * Delete a push token (e.g., on logout)
 * @param token Expo Push Token to delete
 * @returns Promise with success message
 */
export async function deletePushToken(token: string): Promise<void> {
  await fetchAPI<{ success: boolean; data: PushTokenResponse }>(
    '/api/push-tokens',
    {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }
  );
}
