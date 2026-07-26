/**
 * Resolve connection counterparts (senders of incoming requests, or the other
 * side of accepted connections) to their public card profiles — INCLUDING seeded
 * users (AC 4.3). Mirrors web `js/connections.js`: batch `getUsersByIds`, then
 * fall back to `getSeededUsersByIds` for any ids the real `users` table did not
 * return.
 *
 * Keyed on the sorted, de-duplicated id set so the batch is cached and shared by
 * the Requests and Connections tabs. This is an auxiliary profile-batch key
 * (`['counterparts', ids]`), separate from the canonical entity keys in `qk`.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUsersByIds, getSeededUsersByIds } from '@/api/users';
import type { FeedUser } from '@/types/user';

/** id → public card profile. */
export type CounterpartMap = Record<string, FeedUser>;

export function useCounterparts(ids: string[]) {
  const sorted = useMemo(() => [...new Set(ids)].sort(), [ids]);

  return useQuery<CounterpartMap>({
    queryKey: ['counterparts', sorted],
    enabled: sorted.length > 0,
    queryFn: async (): Promise<CounterpartMap> => {
      const byId: CounterpartMap = {};
      const real = await getUsersByIds(sorted);
      for (const u of real.data ?? []) byId[u.id] = u;

      const missing = sorted.filter((id) => !byId[id]);
      if (missing.length) {
        const seeded = await getSeededUsersByIds(missing);
        for (const u of seeded.data ?? []) {
          byId[u.id] = { ...u, __seeded: true } as any;
        }
      }
      return byId;
    },
  });
}
