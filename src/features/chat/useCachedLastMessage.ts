/**
 * Reactive, cache-only reader for a conversation's latest message (Epic 5, Story
 * 5.1 "last-message preview"). The backend has no per-conversation last-message
 * column (mirrors web, whose sidebar preview only fills once a message is known),
 * so the list preview is derived from whatever the `qk.messages(convId)` cache
 * already holds — populated when the thread is opened or when `useMessages`
 * patches it from the realtime channel.
 *
 * Implemented as a DISABLED `useQuery`: it never fetches (so opening the Chats tab
 * costs no extra network), but it observes the cache entry and re-renders when
 * `useMessages` writes to it — keeping the preview reactive from one source (AD-5).
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getMessages } from '@/api/chat';
import type { ChatMessage } from '@/data/useMessages';

/** The latest cached message for a conversation, or `undefined` if none is cached. */
export function useCachedLastMessage(conversationId: string): ChatMessage | undefined {
  const { data } = useQuery({
    queryKey: qk.messages(conversationId),
    // Never runs (enabled:false) — present only so the observer is well-typed and
    // would fetch correctly if ever enabled. The list reads cache written elsewhere.
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data: rows, error } = await getMessages(conversationId, 100);
      if (error) throw new Error(error.message);
      return (rows ?? []) as ChatMessage[];
    },
    enabled: false,
    staleTime: Infinity,
  });
  if (!data || data.length === 0) return undefined;
  return data[data.length - 1];
}

/** One-line preview text for a message: `📋 …` for system events, else the body. */
export function messagePreview(msg: ChatMessage | undefined): string | undefined {
  if (!msg || !msg.body) return undefined;
  return msg.message_type === 'system' ? `📋 ${msg.body}` : msg.body;
}
