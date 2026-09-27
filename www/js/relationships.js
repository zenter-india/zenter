// HallMate — Relationship store.
// Owns Map<otherUserId, { status, role, connectionId }>
// and a pub/sub so cards + modals stay in sync without re-fetching.

export const REL = Object.freeze({
  NONE:        'none',
  PENDING_OUT: 'pending_out',
  PENDING_IN:  'pending_in',
  CONNECTED:   'connected',
  REJECTED:    'rejected',
});

const store       = new Map();
const subscribers = new Set();

export function get(otherUserId) {
  return store.get(otherUserId) || { status: REL.NONE, connectionId: null };
}

export function set(otherUserId, rel) {
  store.set(otherUserId, rel);
  subscribers.forEach((fn) => { try { fn(otherUserId, rel); } catch {} });
}

// fn(changedUserId, rel) — returns unsubscribe function.
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// Bulk load from raw Supabase rows. Does NOT notify subscribers (bulk init).
export function hydrate(rows, myUserId) {
  store.clear();
  (rows || []).forEach((row) => {
    const isSender = row.sender_id === myUserId;
    const otherId  = isSender ? row.receiver_id : row.sender_id;

    const status =
      row.status === 'accepted' ? REL.CONNECTED  :
      row.status === 'rejected' ? REL.REJECTED   :
      row.status === 'pending' && isSender  ? REL.PENDING_OUT :
      row.status === 'pending' && !isSender ? REL.PENDING_IN  : null;

    if (status) {
      store.set(otherId, {
        status,
        role: isSender ? 'sender' : 'receiver',
        connectionId: row.id,
      });
    }
  });
}

// Returns array of { userId, connectionId } for pending incoming requests.
export function getIncomingPending() {
  const result = [];
  store.forEach((rel, userId) => {
    if (rel.status === REL.PENDING_IN) result.push({ userId, connectionId: rel.connectionId });
  });
  return result;
}

export function countIncomingPending() {
  return getIncomingPending().length;
}
