/**
 * Single unread selector (AD-5, AD-11, FR-19). Derives total unread from the one
 * `qk.conversations(userId)` query plus the device-local last-read store, and
 * pushes the count to the Chats tab badge. `useLastRead` exposes the reactive map
 * so the conversation list can render per-row unread dots from the same source.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { navBadges } from '@/stores/navBadges';
import {
  subscribeLastRead,
  lastReadSnapshot,
  hydrateLastRead,
  isConversationUnread,
  type LastReadMap,
} from '@/api/chat';
import { useConversations } from './useConversations';

/** Reactive device-local last-read map for a user (hydrated on mount). */
export function useLastRead(userId: string | null | undefined): LastReadMap {
  useEffect(() => {
    if (userId) void hydrateLastRead(userId);
  }, [userId]);

  const getSnapshot = () => lastReadSnapshot(userId);
  return useSyncExternalStore(subscribeLastRead, getSnapshot, getSnapshot);
}

/**
 * Total number of conversations with unread activity. Feeds both the Chats badge
 * (side effect) and can back the row dots (via `useLastRead` + `isConversationUnread`).
 */
export function useUnread(userId: string | null | undefined): number {
  const { data: conversations } = useConversations(userId);
  const lastRead = useLastRead(userId);

  const total = useMemo(
    () => (conversations ?? []).reduce((n, c) => n + (isConversationUnread(c, lastRead) ? 1 : 0), 0),
    [conversations, lastRead],
  );

  useEffect(() => {
    navBadges.set({ chats: total });
  }, [total]);

  return total;
}
