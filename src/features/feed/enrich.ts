/**
 * Feed presentation helpers (Epic 3). Pure mappers that turn a raw {@link FeedUser}
 * row into the props the foundation {@link MateCardData} expects, plus the
 * travel/stay icon+label lookups and the "Joined <Month Year>" formatter.
 *
 * Ported byte-for-byte from web `js/dashboard.js` (`TRAVEL_ICON`/`TRAVEL_LABEL`,
 * `STAY_ICON`/`STAY_LABEL`, `formatDate`, and the `mateCard` home/centre
 * composition) so the native card reads identically to the production feed.
 * No I/O, no React — safe to unit-test.
 */

import type { FeedUser } from '@/types/user';
import type { MateCardData } from '@/components';

// ─── Travel / stay enrichment (verbatim from js/dashboard.js) ─────────────────

/** Stored `travel_mode` value → emoji icon. */
export const TRAVEL_ICON: Record<string, string> = {
  'By train': '🚂',
  'By flight': '✈️',
  'By bus': '🚌',
  'Self-drive': '🚗',
  'Shared Cab': '🚕',
  Other: '🚐',
};

/** Stored `travel_mode` value → short label. */
export const TRAVEL_LABEL: Record<string, string> = {
  'By train': 'Train',
  'By flight': 'Flight',
  'By bus': 'Bus',
  'Self-drive': 'Self Drive',
  'Shared Cab': 'Shared Cab',
  Other: 'Other',
};

/** Stored `stay_plan` value → emoji icon. */
export const STAY_ICON: Record<string, string> = {
  'Need accommodation': '🏨',
  'Have accommodation': '🏠',
  'Looking for room share': '🛏️',
  Other: '🏡',
};

/** Stored `stay_plan` value → short label. */
export const STAY_LABEL: Record<string, string> = {
  'Need accommodation': 'Needs stay',
  'Have accommodation': 'Has stay',
  'Looking for room share': 'Room share',
  Other: 'Yet to Decide',
};

/** Accessibility label for the travel icon (screen-reader), keyed by value. */
export function travelA11y(mode: string | null | undefined): string | undefined {
  return mode ? TRAVEL_LABEL[mode] : undefined;
}

/** Accessibility label for the stay icon (screen-reader), keyed by value. */
export function stayA11y(plan: string | null | undefined): string | undefined {
  return plan ? STAY_LABEL[plan] : undefined;
}

/** "🚂 Train" combined chip, or undefined when the mode is unset/unknown. */
export function travelChip(mode: string | null | undefined): string | undefined {
  if (!mode) return undefined;
  const icon = TRAVEL_ICON[mode];
  const label = TRAVEL_LABEL[mode];
  if (!label) return undefined;
  return icon ? `${icon} ${label}` : label;
}

/** "🏨 Needs stay" combined chip, or undefined when the plan is unset/unknown. */
export function stayChip(plan: string | null | undefined): string | undefined {
  if (!plan) return undefined;
  const icon = STAY_ICON[plan];
  const label = STAY_LABEL[plan];
  if (!label) return undefined;
  return icon ? `${icon} ${label}` : label;
}

// ─── Location + date formatting ───────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "June 2026" from an ISO timestamp — the web card's `formatDate`
 * (`toLocaleDateString('en-IN', { month:'long', year:'numeric' })`), formatted
 * manually so it does not depend on the RN Intl build. Empty → '—'.
 */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Join a district + state into "District, State", dropping empty parts. */
export function joinLoc(a?: string | null, b?: string | null): string {
  return [a, b].filter(Boolean).join(', ');
}

/**
 * Home location: home district + home state ("Pune, Maharashtra"). Home is never
 * used for matching (web comment) — this is display only.
 */
export function homePlace(u: FeedUser): string | undefined {
  return joinLoc(u.district, u.state) || undefined;
}

/**
 * Exam-centre location, with the same legacy fallback the web card uses:
 * `exam_centre_district || district`, `exam_centre_state || state`.
 */
export function centrePlace(u: FeedUser): string | undefined {
  const dist = u.exam_centre_district || u.district;
  const state = u.exam_centre_state || u.state;
  return joinLoc(dist, state) || undefined;
}

// ─── Card mapper ──────────────────────────────────────────────────────────────

/** Map a raw feed row → {@link MateCardData} for the foundation MateCard. */
export function toMateCardData(u: FeedUser): MateCardData {
  return {
    name: u.full_name || 'Aspirant',
    homePlace: homePlace(u),
    centrePlace: centrePlace(u),
    travelLabel: travelChip(u.travel_mode),
    stayLabel: stayChip(u.stay_plan),
    gender: u.gender ?? null,
    verified: u.is_verified_aspirant === true,
    plus: u.plus_member === true,
    joined: u.created_at ? `Joined ${formatMonthYear(u.created_at)}` : undefined,
  };
}
