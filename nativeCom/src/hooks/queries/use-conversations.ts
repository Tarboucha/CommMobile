import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { listConversations } from '@/lib/api/chat';

export function useConversations(type?: 'direct' | 'booking') {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.conversations.list(type),
    queryFn: () => listConversations(type),
    enabled: !!user,
  });
}
