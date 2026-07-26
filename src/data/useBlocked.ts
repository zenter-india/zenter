import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import {
  blockUser,
  unblockUser,
  getBlockedList,
  deleteConnectionsBetween,
  type BlockedListRow,
} from '@/api/blocked';

/**
 * Block / unblock hooks (AD-2). Thin TanStack Query wrappers over `@/api/blocked`
 * that THROW on `{ error }` so `AsyncBoundary`/`useQuery` surface it, and
 * invalidate every key the mutation can affect: the feed (the user should
 * appear/disappear), connections (the relationship is cleared), and the blocked
 * list itself. Mirrors the live web flows in `js/dashboard.js` (block) and
 * `js/blocked-users.js` (unblock).
 */

/** Full blocked-users list for the current user. `qk.blocked(userId)`. */
export function useBlockedList(userId: string | null | undefined) {
  return useQuery<BlockedListRow[]>({
    queryKey: qk.blocked(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getBlockedList(userId as string);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type BlockVars = { myId: string; userId: string; reason?: string | null };
type UnblockVars = { myId: string; blockedId: string };

function invalidateBlockScope(
  qc: ReturnType<typeof useQueryClient>,
  myId: string,
) {
  qc.invalidateQueries({ queryKey: qk.feed(myId) });
  qc.invalidateQueries({ queryKey: qk.connections(myId) });
  qc.invalidateQueries({ queryKey: qk.blocked(myId) });
}

/**
 * Block a user, then clear any connection rows between the two (non-fatal — the
 * block already succeeded). Mirrors `doBlock` in `js/dashboard.js`.
 */
export function useBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ myId, userId, reason }: BlockVars) => {
      const { data, error } = await blockUser(myId, userId, reason ?? null);
      if (error) throw new Error(error.message);
      // Non-fatal cleanup: drop any existing connection rows so the blocked user
      // disappears from Connections immediately and can't re-establish via a
      // stale row. The block itself already succeeded, so ignore this error.
      await deleteConnectionsBetween(myId, userId);
      return data;
    },
    onSuccess: (_data, { myId }) => invalidateBlockScope(qc, myId),
  });
}

/**
 * Unblock a user, then clear any stale connection rows between the two (non-fatal)
 * so both sides get a clean slate and can send fresh requests. Mirrors the
 * unblock handler in `js/blocked-users.js`.
 */
export function useUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ myId, blockedId }: UnblockVars) => {
      const { data, error } = await unblockUser(myId, blockedId);
      if (error) throw new Error(error.message);
      // Non-fatal: clear any connection rows left over from before the block.
      await deleteConnectionsBetween(myId, blockedId);
      return data;
    },
    onSuccess: (_data, { myId }) => invalidateBlockScope(qc, myId),
  });
}
