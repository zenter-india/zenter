/**
 * Feed filter state (Story 3.3) — client state, AD-2. The filter sheet
 * (`app/filters.tsx`) writes here and the feed (`app/(tabs)/feed.tsx`) reads it,
 * so changing a filter updates the list + live count reactively without a refetch.
 *
 * Kept dependency-light with `useSyncExternalStore`, mirroring `stores/navBadges`
 * (the codebase's established external-store shape) — no new dependency. The
 * stored shape is a subset of the pure {@link FeedFilters} predicate in
 * `@/domain/matching`; `null` means "unset" (the predicate skips it), so it maps
 * straight into `applyFeedFilters`.
 */
import { useSyncExternalStore } from 'react';
import type { FeedFilters } from '@/domain/matching';

/**
 * The filters the native sheet exposes: gender, travel, stay.
 *
 * Deliberately NO district: the sheet only opens from inside a district, so the
 * district is already chosen by the drill-down. It used to be here, but the feed
 * screen scopes by its own `activeDistrict` and passes `district: null` into the
 * predicate — so the control changed nothing while still counting toward the
 * "N active" badge and keeping "Clear all" enabled.
 */
export type FeedFilterState = {
  gender: string | null;
  travelMode: string | null;
  stayPlan: string | null;
};

const EMPTY: FeedFilterState = { gender: null, travelMode: null, stayPlan: null };

let state: FeedFilterState = EMPTY;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const feedFilters = {
  get: () => state,
  /** Patch one or more filters; pass `null` (or `''`, normalised to `null`) to clear one. */
  set(patch: Partial<FeedFilterState>) {
    const next = { ...state };
    for (const [k, v] of Object.entries(patch)) {
      next[k as keyof FeedFilterState] = v ? v : null;
    }
    state = next;
    emit();
  },
  /** Clear every filter. */
  reset() {
    if (state === EMPTY) return;
    state = EMPTY;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Reactive read of the current filter state. */
export function useFeedFilters(): FeedFilterState {
  return useSyncExternalStore(feedFilters.subscribe, feedFilters.get, feedFilters.get);
}

/** How many filters are currently applied (drives the "Filters" button dot/label). */
export function activeFilterCount(f: FeedFilterState): number {
  return (f.gender ? 1 : 0) + (f.travelMode ? 1 : 0) + (f.stayPlan ? 1 : 0);
}

/** Whether any filter is applied — selects the correct empty-state copy. */
export function hasActiveFilters(f: FeedFilterState): boolean {
  return activeFilterCount(f) > 0;
}

/**
 * Adapt the store shape to the pure `applyFeedFilters` predicate input. The
 * predicate's `district` is left to the caller — the feed scopes it from the
 * drill-down, not from stored filter state.
 */
export function toFeedPredicate(f: FeedFilterState): FeedFilters {
  return {
    gender: f.gender,
    travelMode: f.travelMode,
    stayPlan: f.stayPlan,
  };
}
