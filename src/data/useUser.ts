/**
 * Other-user hook (AD-2). `useUser(id)` owns qk.user(id) = another member's
 * public card projection (never the full self record). Backed by the batch
 * `getUsersByIds`, mirroring web, which has no single-user-by-id read.
 *
 * Falls back to `getSeededUsersByIds` when the id isn't in `users` — mirrors
 * `useCounterparts`' real→seeded fallback (AC 4.3), since a connection or
 * conversation counterpart can be a seeded/demo profile that only exists in
 * `seeded_users`. Without this, seeded counterparts resolve to no row and
 * every caller falls back to a generic placeholder (e.g. chat's "Aspirant").
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getUsersByIds, getSeededUsersByIds } from '@/api/users';
import { unwrap } from '@/api/result';

/** Another member's public card; `null` when the id resolves to no row. */
export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: async () => {
      const rows = unwrap(await getUsersByIds([id as string]));
      if (rows?.[0]) return rows[0];
      const seeded = unwrap(await getSeededUsersByIds([id as string]));
      return seeded?.[0] ?? null;
    },
    enabled: !!id,
  });
}
