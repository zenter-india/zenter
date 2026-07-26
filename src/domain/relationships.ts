/**
 * Relationship state machine (AD-6) — a PURE projection over the
 * `['connections', userId]` query. Ported from web `js/relationships.js`.
 *
 * The web version kept a mutable singleton `Map` + pub/sub as the source of
 * truth. In the RN app the TanStack Query cache is the single source of truth,
 * so this module is stateless: `hydrate(rows, myUserId)` derives a fresh `Map`
 * from raw connection rows and `relFor(map, id)` reads it. No I/O, no framework,
 * unit-testable in isolation.
 */

export const REL = Object.freeze({
  NONE: 'none',
  PENDING_OUT: 'pending_out',
  PENDING_IN: 'pending_in',
  CONNECTED: 'connected',
  REJECTED: 'rejected',
} as const);

export type RelStatus = (typeof REL)[keyof typeof REL];

/** Which side of the row the current user is on (null when no relationship). */
export type RelRole = 'sender' | 'receiver' | null;

/** The projected relationship of the current user toward one other user. */
export type RelEntry = {
  status: RelStatus;
  role: RelRole;
  connectionId: string | null;
};

/** otherUserId → RelEntry. */
export type RelMap = Map<string, RelEntry>;

/** Raw `connections` row shape (subset the projection depends on). */
export type ConnectionRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | string;
  created_at?: string | null;
  updated_at?: string | null;
};

/** The default entry for a pair with no relationship row. Frozen + shared. */
export const NO_REL: RelEntry = Object.freeze({
  status: REL.NONE,
  role: null,
  connectionId: null,
});

/**
 * Derive the per-user relationship map from raw Supabase connection rows.
 * Mirrors web `hydrate()` exactly: for each row the "other" user is whichever
 * side is NOT `myUserId`, and the status is projected from the row's
 * `status` + whether I am the sender.
 */
export function hydrate(rows: ConnectionRow[] | null | undefined, myUserId: string): RelMap {
  const map: RelMap = new Map();
  for (const row of rows ?? []) {
    const isSender = row.sender_id === myUserId;
    const otherId = isSender ? row.receiver_id : row.sender_id;

    const status: RelStatus | null =
      row.status === 'accepted' ? REL.CONNECTED :
      row.status === 'rejected' ? REL.REJECTED :
      row.status === 'pending' && isSender ? REL.PENDING_OUT :
      row.status === 'pending' && !isSender ? REL.PENDING_IN :
      null;

    if (status) {
      map.set(otherId, {
        status,
        role: isSender ? 'sender' : 'receiver',
        connectionId: row.id,
      });
    }
  }
  return map;
}

/** Relationship of the current user toward `otherUserId` (NO_REL if none). */
export function relFor(map: RelMap, otherUserId: string): RelEntry {
  return map.get(otherUserId) ?? NO_REL;
}

/** All pending INCOMING requests (someone asked to connect with me). */
export function getIncomingPending(map: RelMap): { userId: string; connectionId: string | null }[] {
  const out: { userId: string; connectionId: string | null }[] = [];
  map.forEach((rel, userId) => {
    if (rel.status === REL.PENDING_IN) out.push({ userId, connectionId: rel.connectionId });
  });
  return out;
}

/** Count of pending incoming requests — drives the Requests nav badge. */
export function countIncomingPending(map: RelMap): number {
  let n = 0;
  map.forEach((rel) => { if (rel.status === REL.PENDING_IN) n += 1; });
  return n;
}

// ─── Transitions ─────────────────────────────────────────────────────────────
// The valid optimistic state changes a user action can trigger. Mutation hooks
// use `nextStatus(current, action)` as the single source of the target state so
// the guardrails (no double-send, only the receiver accepts/declines, only the
// sender withdraws) live in one place.

export type RelAction = 'send' | 'withdraw' | 'accept' | 'decline';

/**
 * The status to move to for `action` from `current`, or `null` if the action
 * is not permitted in that state (caller should treat null as "blocked").
 *   send:     NONE        → PENDING_OUT
 *   withdraw: PENDING_OUT → NONE
 *   accept:   PENDING_IN  → CONNECTED
 *   decline:  PENDING_IN  → REJECTED
 */
export function nextStatus(current: RelStatus, action: RelAction): RelStatus | null {
  switch (action) {
    case 'send':     return current === REL.NONE ? REL.PENDING_OUT : null;
    case 'withdraw': return current === REL.PENDING_OUT ? REL.NONE : null;
    case 'accept':   return current === REL.PENDING_IN ? REL.CONNECTED : null;
    case 'decline':  return current === REL.PENDING_IN ? REL.REJECTED : null;
    default:         return null;
  }
}

/** Whether `action` is allowed from `current`. Convenience over `nextStatus`. */
export function canTransition(current: RelStatus, action: RelAction): boolean {
  return nextStatus(current, action) !== null;
}
