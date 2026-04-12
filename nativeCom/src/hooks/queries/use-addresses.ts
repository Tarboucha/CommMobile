import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { getAddresses } from '@/lib/api/addresses';

export function useAddresses() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.addresses.all,
    queryFn: getAddresses,
    enabled: !!user,
  });
}
