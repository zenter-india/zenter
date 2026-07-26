import { QueryClient } from '@tanstack/react-query';

/** App-wide server-state cache (AD-2). Realtime keeps chat fresh, so staleTime is
 * moderate; retry is bounded so a bad network surfaces an error state (AD-12) rather
 * than hanging. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false, // we drive foreground refetch explicitly (AD-10)
    },
    mutations: { retry: 0 },
  },
});
