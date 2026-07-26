/**
 * Live Chats tab-badge sync (FR-19, FR-32). Headless: mounted once in the tab
 * layout so the unread count stays live regardless of which tab is active (the
 * Chats screen unmounts when you leave it). Delegates to `useUnread`, the single
 * unread selector (AD-5), which reads the one `qk.conversations(userId)` query plus
 * the device-local last-read store and pushes `navBadges.set({ chats })` itself —
 * so the badge and the per-row dots derive from exactly the same source.
 */
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useUnread } from '@/data/useUnread';

export function ChatsBadge() {
  const userId = useMyUserId();
  useUnread(userId);
  return null;
}
