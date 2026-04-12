import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 minutes — cached data shown instantly on revisit
      gcTime: 10 * 60 * 1000,         // 10 minutes — inactive data garbage collected
      retry: 1,                        // API client already retries 3x, avoid double-retry
      refetchOnWindowFocus: false,     // Not relevant in React Native
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
