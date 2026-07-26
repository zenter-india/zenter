import { REL, hydrate, relFor, getIncomingPending, countIncomingPending, nextStatus, canTransition } from '@/domain/relationships';

const ME = 'me-id';
const OTHER = 'other-id';

describe('hydrate', () => {
  it('projects an accepted row to CONNECTED regardless of sender/receiver side', () => {
    const map = hydrate([{ id: 'c1', sender_id: ME, receiver_id: OTHER, status: 'accepted' }], ME);
    expect(relFor(map, OTHER)).toEqual({ status: REL.CONNECTED, role: 'sender', connectionId: 'c1' });
  });

  it('projects a pending row as PENDING_OUT when I am the sender', () => {
    const map = hydrate([{ id: 'c1', sender_id: ME, receiver_id: OTHER, status: 'pending' }], ME);
    expect(relFor(map, OTHER).status).toBe(REL.PENDING_OUT);
  });

  it('projects a pending row as PENDING_IN when I am the receiver', () => {
    const map = hydrate([{ id: 'c1', sender_id: OTHER, receiver_id: ME, status: 'pending' }], ME);
    expect(relFor(map, OTHER).status).toBe(REL.PENDING_IN);
  });

  it('returns NO_REL for a user with no connection row', () => {
    const map = hydrate([], ME);
    expect(relFor(map, OTHER)).toEqual({ status: REL.NONE, role: null, connectionId: null });
  });
});

describe('getIncomingPending / countIncomingPending', () => {
  it('lists and counts only PENDING_IN entries', () => {
    const map = hydrate(
      [
        { id: 'c1', sender_id: 'a', receiver_id: ME, status: 'pending' },
        { id: 'c2', sender_id: 'b', receiver_id: ME, status: 'pending' },
        { id: 'c3', sender_id: ME, receiver_id: 'c', status: 'pending' }, // outgoing — excluded
        { id: 'c4', sender_id: 'd', receiver_id: ME, status: 'accepted' }, // not pending — excluded
      ],
      ME,
    );
    expect(countIncomingPending(map)).toBe(2);
    expect(getIncomingPending(map).map((r) => r.userId).sort()).toEqual(['a', 'b']);
  });
});

describe('nextStatus / canTransition', () => {
  it('allows the documented transitions', () => {
    expect(nextStatus(REL.NONE, 'send')).toBe(REL.PENDING_OUT);
    expect(nextStatus(REL.PENDING_OUT, 'withdraw')).toBe(REL.NONE);
    expect(nextStatus(REL.PENDING_IN, 'accept')).toBe(REL.CONNECTED);
    expect(nextStatus(REL.PENDING_IN, 'decline')).toBe(REL.REJECTED);
  });

  it('blocks actions not valid from the current state', () => {
    expect(nextStatus(REL.CONNECTED, 'send')).toBeNull();
    expect(nextStatus(REL.NONE, 'accept')).toBeNull();
    expect(canTransition(REL.PENDING_OUT, 'accept')).toBe(false);
  });
});
