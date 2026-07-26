import { applyFeedFilters, type FeedFilters } from '@/domain/matching';
import type { FeedUser } from '@/types/user';

function user(overrides: Partial<FeedUser>): FeedUser {
  return {
    id: 'u1',
    full_name: 'Test User',
    gender: 'Female',
    state: null,
    district: null,
    exam_centre_state: null,
    exam_centre_district: 'Chennai',
    exam_center: null,
    phone_last3: '210',
    travel_mode: null,
    stay_plan: null,
    bio: null,
    ...overrides,
  };
}

// Regression coverage for the feed screen's double district-filter fix: the
// screen now always passes `district: null` into the shared predicate and
// scopes district purely via the grid's activeDistrict selection instead.
describe('applyFeedFilters — district', () => {
  const chennai = user({ id: 'a', exam_centre_district: 'Chennai' });
  const madurai = user({ id: 'b', exam_centre_district: 'Madurai' });

  it('restricts to the given district when one is set', () => {
    const filters: FeedFilters = { district: 'Chennai' };
    expect(applyFeedFilters([chennai, madurai], filters).map((u) => u.id)).toEqual(['a']);
  });

  it('does not filter by district when district is null (the feed screen path)', () => {
    const filters: FeedFilters = { district: null };
    expect(applyFeedFilters([chennai, madurai], filters).map((u) => u.id).sort()).toEqual(['a', 'b']);
  });
});

describe('applyFeedFilters — other fields', () => {
  it('applies gender as an exact case-insensitive match', () => {
    const female = user({ id: 'a', gender: 'Female' });
    const male = user({ id: 'b', gender: 'Male' });
    expect(applyFeedFilters([female, male], { gender: 'female' }).map((u) => u.id)).toEqual(['a']);
  });

  it('applies examCenter as a case-insensitive substring match', () => {
    const match = user({ id: 'a', exam_center: 'AIIMS Delhi' });
    const noMatch = user({ id: 'b', exam_center: 'JIPMER' });
    expect(applyFeedFilters([match, noMatch], { examCenter: 'delhi' }).map((u) => u.id)).toEqual(['a']);
  });
});
