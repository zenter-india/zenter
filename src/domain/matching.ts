/**
 * Feed composition rules (AD-9) — pure domain logic, no I/O, no React. Ported
 * verbatim from the live web `js/dashboard.js` (`shuffleMerge`, the `loadData`
 * feed filter + sort, and the in-district `applyFilters` predicate) so the RN
 * feed orders identically to production.
 *
 * This module composes the neighbouring foundation rather than re-declaring it:
 *   - exam-type / exam-centre-state gating → `@/domain/gating`
 *     (`isAdminRole`, `matchesCentre`; LIVE_EXAMS / NEIGHBOURING_STATES live there).
 *   - the relationship state machine → `@/domain/relationships`
 *     (`hydrate` / `relFor`; the REL vocabulary and per-user projection).
 *   - the user row shapes → `@/types/user` (`FeedUser`).
 * Exam-type scoping itself is enforced upstream by the feed query
 * (`getAllUsers` / `getSeededUsers`), exactly as the web does — buildFeed does
 * NOT re-check exam type.
 *
 * The pipeline (exactly as web `loadData`):
 *   1. tag seeded rows `__seeded` (+ null their `exam_center` when the config
 *      toggle hides it); drop all seeded when `seededUsersVisible` is false.
 *   2. `shuffleMerge(real, seeded)` — one seeded row after every
 *      `gap = max(1, floor(real.length / (seeded.length + 1)))` real rows.
 *   3. filter: drop self, drop both block-sets, and keep only rows passing
 *      `matchesCentre` (own exam-centre state + neighbours; admins/UPSC-CMS see
 *      everyone).
 *   4. stable sort: Plus members first, then the signed-in user's own
 *      `exam_centre_district`, otherwise original (created_at desc) order.
 *
 * Each result row carries a `rel` (`RelEntry`) derived from the caller's
 * connection rows so a feed row can render its Connect / Sent / Accept /
 * Open-chat CTA without a second lookup.
 */

import { isAdminRole, matchesCentre } from '@/domain/gating';
import { hydrate, relFor, type RelMap, type RelEntry, type ConnectionRow } from '@/domain/relationships';
import type { FeedUser } from '@/types/user';

// Re-export the canonical row/relationship shapes so feed consumers can import
// them from one place alongside FeedItem.
export type { FeedUser };
export type { ConnectionRow, RelEntry };

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The signed-in user's matching inputs. A structural subset that `UserLookup`
 * (from `getUserByPhone`, qk.status) satisfies — kept minimal so buildFeed is
 * trivially unit-testable without a full DB projection.
 */
export type FeedSelf = {
  id?: string | null;
  role?: string | null;
  exam_type?: string | null;
  exam_centre_state?: string | null;
  exam_centre_district?: string | null;
};

/** Feed-only visibility toggles (from the parsed `AppConfig`, AD-2). */
export type FeedConfig = {
  /** `seeded_users_visible` — default true (visible unless explicitly false). */
  seededUsersVisible?: boolean;
  /** `seeded_exam_centre_visible` — default true; when false, seeded exam_center is nulled. */
  seededCentreVisible?: boolean;
};

/** A user row plus feed metadata: seeded flag + derived relationship state. */
export type FeedItem = FeedUser & { __seeded?: boolean; rel: RelEntry };

export type BuildFeedParams = {
  me: FeedSelf | null | undefined;
  allUsers: FeedUser[];
  seededUsers: FeedUser[];
  myConnections: ConnectionRow[];
  blockedIds: string[];
  blockedByIds: string[];
  config?: FeedConfig;
};

type FeedRow = FeedUser & { __seeded?: boolean };

// ─── shuffleMerge ─────────────────────────────────────────────────────────────

/**
 * Interleave seeded rows evenly among real rows so seeded profiles appear mixed
 * in the feed. One seeded row is inserted after every `gap` real rows, where
 * `gap = max(1, floor(real.length / (seeded.length + 1)))`; leftover seeded rows
 * are appended. Byte-for-byte the web `shuffleMerge`.
 */
export function shuffleMerge<T>(real: T[], seeded: T[]): T[] {
  if (!seeded.length) return [...real];
  if (!real.length) return [...seeded];
  const result: T[] = [];
  const gap = Math.max(1, Math.floor(real.length / (seeded.length + 1)));
  let si = 0;
  for (let i = 0; i < real.length; i++) {
    result.push(real[i]!);
    if (si < seeded.length && (i + 1) % gap === 0) {
      result.push(seeded[si++]!);
    }
  }
  while (si < seeded.length) result.push(seeded[si++]!);
  return result;
}

// ─── buildFeed ────────────────────────────────────────────────────────────────

/** Compose the ordered, filtered, rel-tagged feed. Pure — safe to unit test. */
export function buildFeed(params: BuildFeedParams): FeedItem[] {
  const { me, allUsers, seededUsers, myConnections, blockedIds, blockedByIds, config } = params;

  const myUserId = me?.id ?? null;
  // Admins/superadmins have no own-district priority (they see all districts).
  const matchDistrict = isAdminRole(me?.role) ? null : me?.exam_centre_district ?? null;

  const seededVisible = config?.seededUsersVisible !== false;
  const seededCentreVisible = config?.seededCentreVisible !== false;

  // 1. Prepare seeded rows: tag __seeded, optionally null exam_center.
  const seeded: FeedRow[] = seededVisible
    ? (seededUsers ?? []).map((u) => {
        const base: FeedUser = seededCentreVisible ? u : { ...u, exam_center: null };
        return { ...base, __seeded: true };
      })
    : [];

  const real: FeedRow[] = (allUsers ?? []).map((u) => ({ ...u }));

  // 2. Interleave (on the UNFILTERED real length, exactly as web).
  const combined = shuffleMerge<FeedRow>(real, seeded);

  const relMap: RelMap = myUserId ? hydrate(myConnections ?? [], myUserId) : new Map();
  const blocked = new Set(blockedIds ?? []);
  const blockedBy = new Set(blockedByIds ?? []);

  // 3. Filter: self, both block-sets, and exam-centre-state gating (@/domain/gating).
  const filtered = combined.filter((u) => {
    if (u.id === myUserId) return false;
    if (blocked.has(u.id)) return false; // users I blocked
    if (blockedBy.has(u.id)) return false; // users who blocked me
    if (!matchesCentre(me, u)) return false;
    return true;
  });

  // 4. Stable sort: Plus first, then own exam-centre-district, else input order.
  const decorated = filtered.map((u, i) => ({ u, i }));
  decorated.sort((a, b) => {
    const ap = a.u.plus_member === true;
    const bp = b.u.plus_member === true;
    if (ap !== bp) return ap ? -1 : 1;
    if (matchDistrict) {
      const aSame = a.u.exam_centre_district === matchDistrict;
      const bSame = b.u.exam_centre_district === matchDistrict;
      if (aSame !== bSame) return aSame ? -1 : 1;
    }
    return a.i - b.i; // preserve original order within ties (explicit stability)
  });

  return decorated.map(({ u }) => ({ ...u, rel: relFor(relMap, u.id) }));
}

// ─── In-district filter predicate (web applyFilters) ──────────────────────────

/**
 * Filters applied once the user has drilled into a district/centre. `district`
 * is the picked `exam_centre_district` (exact match, as the web card sets
 * `activeDistrict`); the rest mirror the web FILTERS config: `gender` /
 * `travelMode` / `stayPlan` are exact (normalised) matches, `examCenter` is a
 * case-insensitive substring search.
 */
export type FeedFilters = {
  district?: string | null;
  gender?: string | null;
  examCenter?: string | null;
  travelMode?: string | null;
  stayPlan?: string | null;
};

const norm = (s: unknown): string => (s ?? '').toString().trim().toLowerCase();

/** True when a user passes the active in-district filters. */
export function matchesFilters(u: FeedUser, filters: FeedFilters): boolean {
  // District is an exact (case-sensitive) match, like the web activeDistrict.
  if (filters.district && u.exam_centre_district !== filters.district) return false;

  const gender = norm(filters.gender);
  if (gender && norm(u.gender) !== gender) return false;

  const examCenter = norm(filters.examCenter);
  if (examCenter && !norm(u.exam_center).includes(examCenter)) return false;

  const travel = norm(filters.travelMode);
  if (travel && norm(u.travel_mode) !== travel) return false;

  const stay = norm(filters.stayPlan);
  if (stay && norm(u.stay_plan) !== stay) return false;

  return true;
}

/** Apply the in-district filters to a feed slice. */
export function applyFeedFilters<T extends FeedUser>(feed: T[], filters: FeedFilters): T[] {
  return feed.filter((u) => matchesFilters(u, filters));
}

// ─── District grouping (web groupByDistrict) ──────────────────────────────────

export type DistrictGroup = { name: string; count: number };

/**
 * Group the feed by `exam_centre_district` with counts. The signed-in user's own
 * district sorts first, then the rest by descending aspirant count — mirrors the
 * web district-picker landing.
 */
export function groupByDistrict(feed: FeedUser[], myDistrict: string | null | undefined): DistrictGroup[] {
  const counts = new Map<string, number>();
  for (const u of feed ?? []) {
    const d = u.exam_centre_district;
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const list: DistrictGroup[] = [...counts.entries()].map(([name, count]) => ({ name, count }));
  list.sort((a, b) => {
    if (myDistrict) {
      const aMine = a.name === myDistrict;
      const bMine = b.name === myDistrict;
      if (aMine !== bMine) return aMine ? -1 : 1;
    }
    return b.count - a.count;
  });
  return list;
}
