/**
 * Exam gating + centre-matching rules (AD-9). Pure domain logic, no I/O.
 *
 * Ported verbatim from the live web app:
 *   - LIVE_EXAMS + examYearDisplay + the "not-live → maintenance" gate: js/dashboard.js
 *   - NEIGHBOURING_STATES + the exam-centre-state feed filter: js/dashboard.js loadData()
 *   - UPSC CMS / admin state-gating bypass: js/dashboard.js init()
 *
 * Values must stay byte-for-byte in sync with the web LIVE_EXAMS array and
 * examYearDisplay map (CLAUDE.md "Adding a New Exam Type" checklist).
 */

/**
 * The exam ecosystems that are live in the app. Any other exam_type is routed
 * to the maintenance screen on the web (dashboard.js). Order matters for any
 * UI that iterates it.
 */
export const LIVE_EXAMS = [
  'NEET UG',
  'NEET PG',
  'UPSC CMS',
  'INICET',
  'NEET MDS',
  'NEET SS',
  'FMGE',
  'JEE Main',
] as const;

/** Union of the live exam type strings. */
export type ExamType = (typeof LIVE_EXAMS)[number];

/**
 * States/UTs whose aspirants share exam centres in practice (e.g. Puducherry is
 * a UT geographically embedded in Tamil Nadu). Pairs are matched both ways — a
 * user from either side sees the other's mates too. Mirrors js/dashboard.js.
 */
export const NEIGHBOURING_STATES: Record<string, string[]> = {
  'Tamil Nadu': ['Puducherry'],
  Puducherry: ['Tamil Nadu'],
};

/**
 * Header label shown for each exam type ("NEET UG 2026", etc.). Mirrors the
 * examYearDisplay map in js/dashboard.js. Unknown types fall back to the raw
 * exam type via {@link examLabel}.
 */
export const examYearDisplay: Record<string, string> = {
  'NEET UG': 'NEET UG 2026',
  'NEET PG': 'NEET PG 2026',
  'UPSC CMS': 'UPSC CMS 2026',
  INICET: 'INICET 2026',
  'NEET MDS': 'NEET MDS 2026',
  'NEET SS': 'NEET SS 2026',
  FMGE: 'FMGE 2026 Jun',
  'JEE Main': 'JEE Main 2026',
};

/** Minimal self-projection needed to compute feed gating. */
export interface GatingSelf {
  role?: string | null;
  exam_type?: string | null;
  exam_centre_state?: string | null;
}

/** Minimal other-user projection needed for centre matching. */
export interface CentreCandidate {
  exam_centre_state?: string | null;
}

/** True when `examType` is one of the live exam ecosystems. */
export function isLiveExam(examType: string | null | undefined): examType is ExamType {
  return !!examType && (LIVE_EXAMS as readonly string[]).includes(examType);
}

/** Display label for an exam type — the year-stamped variant, else the raw value. */
export function examLabel(examType: string | null | undefined): string {
  if (!examType) return '';
  return examYearDisplay[examType] ?? examType;
}

/** Admins/superadmins bypass exam + state scoping (they see all users). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Picker/label noun for the exam type's centre grouping. UPSC CMS groups by
 * exam-centre name ("exam centre"); everything else groups by district.
 * Mirrors districtLabel() in js/dashboard.js.
 */
export function centreLabel(examType: string | null | undefined): string {
  return examType === 'UPSC CMS' ? 'exam centre' : 'district';
}

/**
 * The exam-centre state used to gate the feed, or `null` when state gating is
 * disabled. Mirrors js/dashboard.js init(): admins/superadmins see every exam
 * (null), and UPSC CMS matches by centre rather than state (null). Otherwise it
 * is the user's own exam-centre state.
 */
export function effectiveCentreState(me: GatingSelf | null | undefined): string | null {
  if (!me) return null;
  if (isAdminRole(me.role)) return null;
  if (me.exam_type === 'UPSC CMS') return null;
  return me.exam_centre_state ?? null;
}

/**
 * Whether `other` should appear in `me`'s feed on exam-centre-state grounds.
 * Ported from the state-matching filter in js/dashboard.js loadData():
 *   allowedStates = [myState, ...neighbours]; keep only if other's state is in it.
 * When gating is disabled (admin / UPSC CMS / no centre state set) everyone
 * passes — exam-type scoping is enforced upstream by the feed query, and this
 * helper does NOT re-check exam type, self, or blocks.
 */
export function matchesCentre(me: GatingSelf | null | undefined, other: CentreCandidate): boolean {
  const myState = effectiveCentreState(me);
  if (!myState) return true;
  const allowed = [myState, ...(NEIGHBOURING_STATES[myState] ?? [])];
  return allowed.includes(other?.exam_centre_state ?? '');
}
