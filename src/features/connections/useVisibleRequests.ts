/**
 * Incoming requests as the member actually sees them (Epic 4): the pending
 * `REL.PENDING_IN` slice from `useIncomingRequests`, MINUS any sender I've blocked
 * (AC 4.2 "excluding blocked"). Blocking already deletes the connection rows both
 * directions, so this is mostly defensive — but it keeps the Requests list and
 * the tab badge derived from ONE computation so they can never disagree.
 *
 * A blocked-list load failure degrades to "no one blocked" (empty set) rather
 * than hiding the whole tab — the block query throws for AsyncBoundary elsewhere,
 * but here we only read its data.
 */
import { useMemo } from 'react';
import { useIncomingRequests } from '@/data/useRequests';
import { useBlockedList } from '@/data/useBlocked';

export function useVisibleRequests(userId: string | null | undefined) {
  const requests = useIncomingRequests(userId);
  const blocked = useBlockedList(userId ?? undefined);

  const blockedIds = useMemo(
    () => new Set((blocked.data ?? []).map((b) => b.blocked_user_id)),
    [blocked.data],
  );

  const visible = useMemo(
    () => (requests.data ?? []).filter((r) => !blockedIds.has(r.userId)),
    [requests.data, blockedIds],
  );

  return { ...requests, visible };
}
