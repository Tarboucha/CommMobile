import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { getNotifications, getUnreadCount } from '@/lib/api/notifications';
import type { NotificationQueryParams } from '@/types/notification';

export function useNotifications(params?: NotificationQueryParams) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...queryKeys.notifications.all, params] as const,
    queryFn: () => getNotifications(params),
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: getUnreadCount,
    enabled: !!user,
  });
}
