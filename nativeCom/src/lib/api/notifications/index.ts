import { fetchAPI } from '@/lib/api/client';
import type {
  Notification,
  NotificationUnreadCountResponse,
  NotificationResponse,
  NotificationQueryParams,
} from '@/types/notification';

interface NotificationListResponse {
  data: Notification[];
  pagination: {
    has_more: boolean;
    next_cursor: string | null;
    limit: number;
  };
  unread_count: number;
}

/**
 * Get notifications with optional filters (cursor-based pagination)
 */
export async function getNotifications(
  params?: NotificationQueryParams
): Promise<NotificationListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.after) {
    queryParams.append('after', params.after);
  }
  if (params?.is_read !== undefined) {
    queryParams.append('is_read', params.is_read.toString());
  }
  if (params?.notification_type) {
    queryParams.append('notification_type', params.notification_type);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/notifications?${queryString}` : '/api/notifications';

  const response = await fetchAPI<{
    success: boolean;
    data: NotificationListResponse;
  }>(endpoint, {
    method: 'GET',
  });

  return response.data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const response = await fetchAPI<{
    success: boolean;
    data: NotificationUnreadCountResponse;
  }>('/api/notifications/unread-count', {
    method: 'GET',
  });

  return response.data.unread_count;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<Notification> {
  const response = await fetchAPI<{
    success: boolean;
    data: NotificationResponse;
  }>(`/api/notifications/${notificationId}`, {
    method: 'PATCH',
  });

  return response.data.notification;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await fetchAPI<{
    success: boolean;
    data: { message: string };
  }>(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}

/**
 * Mark all notifications as read
 */
export async function dismissAllNotifications(): Promise<void> {
  await fetchAPI<{
    success: boolean;
    data: { message: string };
  }>('/api/notifications/dismiss-all', {
    method: 'PATCH',
  });
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications(): Promise<void> {
  await fetchAPI<{
    success: boolean;
    data: { message: string };
  }>('/api/notifications', {
    method: 'DELETE',
  });
}
