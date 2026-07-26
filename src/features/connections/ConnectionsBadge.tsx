/**
 * Live Requests tab-badge sync (FR-15, FR-32). Headless: mounted once in the tab
 * layout so the incoming-request count stays live regardless of which tab is
 * active. Reads the SAME `useVisibleRequests` computation the Requests screen
 * renders (deduped by query key), so the badge and the list can never disagree.
 *
 * (The Chats badge is fed separately by `useUnread` in Epic 5.)
 */
import { useEffect } from 'react';
import { navBadges } from '@/stores/navBadges';
import { useMyUserId } from './useMyUserId';
import { useVisibleRequests } from './useVisibleRequests';

export function ConnectionsBadge() {
  const userId = useMyUserId();
  const { visible } = useVisibleRequests(userId);
  const count = visible.length;

  useEffect(() => {
    navBadges.set({ requests: count });
  }, [count]);

  return null;
}
