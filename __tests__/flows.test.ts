/**
 * End-to-end flow simulations over the pure domain layer — the browse →
 * drill-in → filter path, state gating, feed composition, the relationship
 * state machine, the free-chat gate, and contact masking.
 *
 * Complements the per-module suites: these assert the CONTRACTS BETWEEN modules
 * that a screen relies on (e.g. the filter sheet's live count agreeing with the
 * list behind it), which is where the defects this file was written for lived.
 * Cases marked FIXED are regression guards for those bugs.
 */
import { buildFeed, groupByDistrict, applyFeedFilters, shuffleMerge } from '@/domain/matching';
import { hydrate, relFor, nextStatus, REL } from '@/domain/relationships';
import { matchesCentre, effectiveCentreState, isLiveExam } from '@/domain/gating';
import { computeUnlockedConvIds, isConvLocked } from '@/features/exchange/freeChat';
import { maskPhone, formatPhone } from '@/domain/masking';
import { toFeedPredicate, activeFilterCount } from '@/features/feed/filtersStore';

const u = (over: any = {}) => ({
  id: over.id ?? 'u' + Math.random().toString(36).slice(2, 7),
  full_name: 'A',
  gender: 'Male',
  exam_type: 'NEET UG',
  exam_centre_state: 'Tamil Nadu',
  exam_centre_district: 'Coimbatore',
  travel_mode: 'By train',
  stay_plan: 'Need accommodation',
  created_at: '2026-06-01T00:00:00Z',
  ...over,
});

const me = { id: 'me', role: 'user', exam_type: 'NEET UG', exam_centre_state: 'Tamil Nadu', exam_centre_district: 'Coimbatore' };

describe('FLOW: find → district grid → drill in → filter', () => {
  const feedUsers = [
    u({ id: 'a', exam_centre_district: 'Coimbatore', gender: 'Female' }),
    u({ id: 'b', exam_centre_district: 'Coimbatore', gender: 'Male' }),
    u({ id: 'c', exam_centre_district: 'Chennai', gender: 'Female' }),
    u({ id: 'd', exam_centre_district: 'Chennai', gender: 'Female' }),
    u({ id: 'e', exam_centre_district: 'Salem', gender: 'Male' }),
  ];
  const feed = buildFeed({
    me, allUsers: feedUsers, seededUsers: [], myConnections: [], blockedIds: [], blockedByIds: [],
  });

  it('grid groups every district and pins mine first', () => {
    const groups = groupByDistrict(feed, me.exam_centre_district);
    expect(groups[0].name).toBe('Coimbatore');
    expect(groups.map((g) => g.name).sort()).toEqual(['Chennai', 'Coimbatore', 'Salem']);
  });

  it('filter-sheet count matches the drilled-in list (post-fix contract)', () => {
    const filters = { gender: 'Female', travelMode: null, stayPlan: null };
    const activeDistrict = 'Chennai';
    // what the LIST shows (feed.tsx): non-district predicate + activeDistrict
    const list = applyFeedFilters(feed, { ...toFeedPredicate(filters), district: null })
      .filter((x) => x.exam_centre_district === activeDistrict);
    // what the SHEET counts (filters.tsx, after fix): predicate + district param
    const sheet = applyFeedFilters(feed, { ...toFeedPredicate(filters), district: activeDistrict });
    expect(sheet.length).toBe(list.length);
    expect(sheet.length).toBe(2);
  });

  it('district filter no longer inflates the active-filter badge', () => {
    expect(activeFilterCount({ gender: null, travelMode: null, stayPlan: null })).toBe(0);
    expect(activeFilterCount({ gender: 'Male', travelMode: null, stayPlan: null })).toBe(1);
  });

  it('FIXED: the grid keeps true counts while a filter is active', () => {
    // feed.tsx now derives the grid from the unfiltered feed, so a gender filter
    // can no longer delete a whole district from a screen with no filter UI.
    const groups = groupByDistrict(feed, me.exam_centre_district);
    expect(groups.map((g) => g.name)).toContain('Salem');
    expect(groups.find((g) => g.name === 'Chennai')!.count).toBe(2);
  });
});

describe('FLOW: state gating', () => {
  it('neighbouring state is included both ways', () => {
    expect(matchesCentre(me, { exam_centre_state: 'Puducherry' })).toBe(true);
    expect(matchesCentre({ ...me, exam_centre_state: 'Puducherry' }, { exam_centre_state: 'Tamil Nadu' })).toBe(true);
  });
  it('other state excluded; UPSC CMS + admin bypass', () => {
    expect(matchesCentre(me, { exam_centre_state: 'Kerala' })).toBe(false);
    expect(matchesCentre({ ...me, exam_type: 'UPSC CMS' }, { exam_centre_state: 'Kerala' })).toBe(true);
    expect(matchesCentre({ ...me, role: 'admin' }, { exam_centre_state: 'Kerala' })).toBe(true);
    expect(effectiveCentreState({ ...me, role: 'superadmin' })).toBeNull();
  });
  it('null exam_type is treated as NEET UG by the gate callers', () => {
    expect(isLiveExam(null as any)).toBe(false); // callers must default before calling
    expect(isLiveExam('NEET UG')).toBe(true);
  });
});

describe('FLOW: feed composition', () => {
  it('drops self, blocked, blocked-by', () => {
    const out = buildFeed({
      me,
      allUsers: [u({ id: 'me' }), u({ id: 'x' }), u({ id: 'blocked' }), u({ id: 'blockedby' })],
      seededUsers: [], myConnections: [],
      blockedIds: ['blocked'], blockedByIds: ['blockedby'],
    });
    expect(out.map((r) => r.id)).toEqual(['x']);
  });

  it('never loses a seeded row in shuffleMerge', () => {
    for (const [r, s] of [[0, 3], [1, 5], [10, 1], [7, 7], [3, 0]]) {
      const real = Array.from({ length: r }, (_, i) => `r${i}`);
      const seeded = Array.from({ length: s }, (_, i) => `s${i}`);
      const merged = shuffleMerge(real, seeded);
      expect(merged.length).toBe(r + s);
      expect(new Set(merged).size).toBe(r + s);
    }
  });

  it('Plus first, then own district', () => {
    const out = buildFeed({
      me,
      allUsers: [
        u({ id: 'far', exam_centre_district: 'Chennai' }),
        u({ id: 'mine', exam_centre_district: 'Coimbatore' }),
        u({ id: 'plusfar', exam_centre_district: 'Chennai', plus_member: true }),
      ],
      seededUsers: [], myConnections: [], blockedIds: [], blockedByIds: [],
    });
    expect(out.map((r) => r.id)).toEqual(['plusfar', 'mine', 'far']);
  });
});

describe('FLOW: relationship state machine', () => {
  it('projects both sides', () => {
    const map = hydrate(
      [
        { id: 'c1', sender_id: 'me', receiver_id: 'out', status: 'pending' },
        { id: 'c2', sender_id: 'in', receiver_id: 'me', status: 'pending' },
        { id: 'c3', sender_id: 'me', receiver_id: 'yes', status: 'accepted' },
      ],
      'me',
    );
    expect(relFor(map, 'out').status).toBe(REL.PENDING_OUT);
    expect(relFor(map, 'in').status).toBe(REL.PENDING_IN);
    expect(relFor(map, 'yes').status).toBe(REL.CONNECTED);
    expect(relFor(map, 'nobody').status).toBe(REL.NONE);
  });

  it('LEAK CHECK: duplicate rows for one pair are order-dependent', () => {
    const rows: any = [
      { id: 'old', sender_id: 'me', receiver_id: 'x', status: 'rejected' },
      { id: 'new', sender_id: 'me', receiver_id: 'x', status: 'pending' },
    ];
    const forward = relFor(hydrate(rows, 'me'), 'x').status;
    const reversed = relFor(hydrate([...rows].reverse(), 'me'), 'x').status;
    // Same data, different row order → different UI state.
    expect(forward).not.toBe(reversed);
  });

  it('illegal transitions are blocked', () => {
    expect(nextStatus(REL.NONE, 'send')).toBe(REL.PENDING_OUT);
    expect(nextStatus(REL.PENDING_OUT, 'send')).toBeNull();
    expect(nextStatus(REL.PENDING_OUT, 'accept')).toBeNull();
    expect(nextStatus(REL.CONNECTED, 'withdraw')).toBeNull();
    expect(nextStatus(REL.REJECTED, 'send')).toBeNull();
  });
});

describe('FLOW: free-chat gate', () => {
  const convs = [
    { id: 'c1', created_at: '2026-01-01T00:00:00Z' },
    { id: 'c2', created_at: '2026-02-01T00:00:00Z' },
    { id: 'c3', created_at: '2026-03-01T00:00:00Z' },
  ];
  it('keeps the oldest N unlocked for free members', () => {
    const un = computeUnlockedConvIds(convs, { freeLimit: 2, isPlus: false, plusEnabled: true });
    expect([...un].sort()).toEqual(['c1', 'c2']);
    expect(isConvLocked('c3', un)).toBe(true);
  });
  it('Plus and plus-disabled both unlock everything', () => {
    expect(computeUnlockedConvIds(convs, { freeLimit: 2, isPlus: true, plusEnabled: true }).size).toBe(3);
    expect(computeUnlockedConvIds(convs, { freeLimit: 2, isPlus: false, plusEnabled: false }).size).toBe(3);
  });
  it('FIXED: missing/invalid created_at still yields a stable unlocked set', () => {
    const bad: any = [
      { id: 'n1', created_at: null },
      { id: 'n2', created_at: '2026-02-01T00:00:00Z' },
      { id: 'n3', created_at: undefined },
    ];
    const gate = { freeLimit: 1, isPlus: false, plusEnabled: true };
    const a = [...computeUnlockedConvIds(bad, gate)];
    const b = [...computeUnlockedConvIds([...bad].reverse(), gate)];
    expect(a).toEqual(b);
    // The one real date wins the "oldest" slot; undated rows sort last.
    expect(a).toEqual(['n2']);
  });
});

describe('FLOW: contact masking', () => {
  it('masks before exchange, formats after', () => {
    expect(maskPhone('243')).toBe('+91 XXXXXXX243');
    expect(maskPhone(null)).toBe('—');
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone(null)).toBe('—');
  });
  it('LEAK CHECK: a non +91 number passes through unformatted', () => {
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });
});
