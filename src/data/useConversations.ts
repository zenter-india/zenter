/**
 * Conversation list hook (AD-2, AD-5). Owns server state under
 * `qk.conversations(userId)`; throws on error so AsyncBoundary/useQuery surface
 * it. On load it seeds device-local read-state (so pre-existing chats don't flash
 * as unread) — the same first-load behavior as `js/chat.js`.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getMyConversations, seedLastReadMap, type Conversation } from '@/api/chat';

export function useConversations(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.conversations(userId ?? 'none'),
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await getMyConversations(userId!);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Seed last-read for newly-seen conversations (idempotent; only fills gaps).
  const conversations = query.data;
  useEffect(() => {
    if (userId && conversations && conversations.length) {
      void seedLastReadMap(userId, conversations);
    }
  }, [userId, conversations]);

  return query;
}
