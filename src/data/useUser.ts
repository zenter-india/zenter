/**
 * Other-user hook (AD-2). `useUser(id)` owns qk.user(id) = another member's
 * public card projection (never the full self record). Backed by the batch
 * `getUsersByIds`, mirroring web, which has no single-user-by-id read.
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getUsersByIds } from '@/api/users';
import { unwrap } from '@/api/result';

/** Another member's public card; `null` when the id resolves to no row. */
export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: async () => {
      const rows = unwrap(await getUsersByIds([id as string]));
      return rows?.[0] ?? null;
    },
    enabled: !!id,
  });
}
