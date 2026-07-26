/**
 * User domain types — the columns and status vocabularies of the live `users`
 * table (docs/data-models-backend.md §users). There are NO Postgres ENUMs; every
 * status is `text` constrained by app convention, so these unions mirror the
 * documented live values and are advisory at the type level.
 *
 * Identity note (AD-4): `phone` (E.164) is the app-wide handle; self records are
 * fetched by phone, other users by id — mirroring the web `js/supabase.js`.
 */

/** Live exam ecosystems — mirrors `LIVE_EXAMS` in web `js/dashboard.js`. */
export type ExamType =
  | 'NEET UG'
  | 'NEET PG'
  | 'UPSC CMS'
  | 'INICET'
  | 'NEET MDS'
  | 'NEET SS'
  | 'FMGE';

/** `users.account_status`: NULL / `'active'` = normal, `'suspended'` = locked out. */
export type AccountStatus = 'active' | 'suspended';

/** `users.role`. */
export type UserRole = 'user' | 'admin' | 'superadmin';

/** `users.gender` — seed data uses Male/Female; the schema is unconstrained text. */
export type Gender = 'Male' | 'Female' | 'Other';

/**
 * The FULL self record (qk.profile(phone)). Superset of what `getProfileByPhone`
 * selects; `role` is optional because the full-profile projection omits it while
 * the lightweight `getUserByPhone` lookup includes it. Most columns are nullable
 * live.
 */
export interface User {
  id: string;
  phone: string;
  full_name: string | null;
  gender: Gender | null;
  state: string | null;
  district: string | null;
  exam_type: ExamType | null;
  exam_centre_state: string | null;
  exam_centre_district: string | null;
  exam_center: string | null;
  college: string | null;
  travel_mode: string | null;
  stay_plan: string | null;
  bio: string | null;
  profile_completed: boolean | null;
  is_profile_paused: boolean | null;
  account_status: AccountStatus | null;
  suspension_warning: boolean | null;
  appeal_submitted_at: string | null;
  plus_member: boolean | null;
  contact_reveals_used: number | null;
  is_verified_aspirant: boolean | null;
  verification_requested: boolean | null;
  verification_rejected: boolean | null;
  nta_application_number: string | null;
  role?: UserRole | null;
  created_at: string | null;
}

/**
 * Lightweight lookup projection returned by `getUserByPhone` — the status/exam
 * source for the root guard (qk.status). Narrower than {@link User}: no name,
 * bio, or contact columns.
 */
export type UserLookup = Pick<
  User,
  | 'id'
  | 'profile_completed'
  | 'exam_type'
  | 'role'
  | 'state'
  | 'exam_centre_state'
  | 'exam_centre_district'
  | 'plus_member'
  | 'contact_reveals_used'
  | 'is_verified_aspirant'
  | 'account_status'
  | 'appeal_submitted_at'
  | 'suspension_warning'
>;

/**
 * Public projection shared by the Find Mates feed (real + seeded rows) and
 * connection cards. A single superset shape covers all three web projections —
 * `getAllUsers` (all fields), `getSeededUsers` (no `plus_member`), and
 * `getUsersByIds` (core card fields only) — so the optional fields are absent,
 * never wrong. The full phone number never appears here — only the last 3
 * digits (`phone_last3`, a server-side generated column), which `maskPhone()`
 * renders as the masked UI. The real number stays server-side until an
 * accepted Contact Exchange (AD-8/NFR-6) surfaces it via `useExchange`.
 */
export interface FeedUser {
  id: string;
  full_name: string | null;
  gender: Gender | null;
  state: string | null;
  district: string | null;
  exam_centre_state: string | null;
  exam_centre_district: string | null;
  exam_center: string | null;
  phone_last3: string | null;
  travel_mode: string | null;
  stay_plan: string | null;
  bio: string | null;
  exam_type?: ExamType | null;
  plus_member?: boolean | null;
  is_verified_aspirant?: boolean | null;
  created_at?: string | null;
}
