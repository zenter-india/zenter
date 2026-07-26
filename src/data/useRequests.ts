/**
 * Incoming connection requests (Epic 4). A projection of the same
 * `connections` rows that back `useConnections`, filtered to the ones where the
 * current user is the receiver and the row is still pending — i.e. the
 * `REL.PENDING_IN` slice of `domain/relationships`. Kept under its own
 * `qk.requests(userId)` cache entry so the Requests tab + nav badge invalidate
 * independently of the full connections list.
 *
 * The returned rows are intentionally lightweight (`userId` + `connectionId`);
 * the Requests screen resolves sender profiles separately (getUsersByIds) so a
 * feed filter can never make a request card's sender vanish.
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getMyConnections } from '@/api/connections';
import type { ConnectionRow } from '@/domain/relationships';

export type IncomingRequest = {
  /** The sender — the user who wants to connect with me. */
  userId: string;
  /** The `connections.id` to accept/decline. */
  connectionId: string;
  createdAt: string | null;
};

/**
 * Pure projection: pending rows where I am the receiver → incoming requests.
 * Mirrors `REL.PENDING_IN` in `domain/relationships.hydrate()`. Newest first.
 */
export function projectIncomingRequests(
  rows: ConnectionRow[] | null | undefined,
  myUserId: string,
): IncomingRequest[] {
  return (rows ?? [])
    .filter((r) => r.status === 'pending' && r.receiver_id === myUserId)
    .map((r) => ({ userId: r.sender_id, connectionId: r.id, createdAt: r.created_at ?? null }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Pending incoming requests for `userId` (my user id). Throws so AsyncBoundary surfaces errors. */
export function useIncomingRequests(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.requests(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<IncomingRequest[]> => {
      const { data, error } = await getMyConnections(userId as string);
      if (error) throw new Error(error.message);
      return projectIncomingRequests((data ?? []) as ConnectionRow[], userId as string);
    },
  });
}
