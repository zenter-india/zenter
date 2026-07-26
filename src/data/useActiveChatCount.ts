/**
 * Active-chat count hook (Epic 7 / Story 7.1, FR-20). Wraps the
 * `get_active_chat_count` RPC (`src/api/connections`) so the Free-Chat banner can
 * show how many of the member's free chat slots are used.
 *
 * Keyed on `qk.activeChats(userId)`; throws on error so a caller can treat a
 * failure as "unknown" (the banner renders nothing rather than crashing the
 * Chats screen). The count equals the number of active conversations returned by
 * `getMyConversations`, so it stays in lockstep with the lock computation in
 * `features/exchange/freeChat.ts`, which orders those same conversations by
 * `created_at`.
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getActiveChatCount } from '@/api/connections';

export function useActiveChatCount(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.activeChats(userId ?? 'none'),
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await getActiveChatCount(userId!);
      if (error) throw new Error(error.message);
      const n = Number(data ?? 0);
      return Number.isFinite(n) ? n : 0;
    },
  });
}
