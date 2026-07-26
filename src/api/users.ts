/**
 * User / profile / feed-source data access (AD-1). Direct ports of the live web
 * surface in `js/supabase.js` — same tables, columns, filters, and semantics.
 * All functions resolve to {@link ApiResult} and never throw.
 *
 * Identity model (AD-4): self records are keyed by `phone` (E.164); other users
 * and connection counterparts by `id`.
 */
import { supabase } from '@/api/client';
import { query, type ApiResult } from '@/api/result';
import type { User, UserLookup, FeedUser, ExamType } from '@/types/user';

/** Columns for the lightweight status/exam lookup (root guard). */
const LOOKUP_COLS =
  'id, profile_completed, exam_type, role, state, exam_centre_state, exam_centre_district, ' +
  'plus_member, contact_reveals_used, is_verified_aspirant, account_status, appeal_submitted_at, suspension_warning';

/** Columns for the FULL self profile record. */
const PROFILE_COLS =
  'id, phone, full_name, gender, state, district, ' +
  'exam_centre_state, exam_centre_district, exam_center, exam_type, ' +
  'college, travel_mode, stay_plan, bio, ' +
  'profile_completed, is_profile_paused, account_status, appeal_submitted_at, suspension_warning, ' +
  'plus_member, contact_reveals_used, is_verified_aspirant, verification_requested, verification_rejected, ' +
  'nta_application_number, created_at';

/**
 * Public feed-card columns (real users). `phone_last3` (server-generated,
 * see `20260721_mask_phone_in_public_projections.sql`), NEVER the full
 * `phone` — the real number must stay server-side until an accepted Contact
 * Exchange (AD-8/NFR-6); see `maskPhone()` in `@/domain/masking`.
 */
const FEED_COLS =
  'id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, ' +
  'phone_last3, travel_mode, stay_plan, bio, exam_type, plus_member, is_verified_aspirant, created_at';

/** Public feed-card columns (seeded users — no plus_member). */
const SEEDED_FEED_COLS =
  'id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, ' +
  'phone_last3, travel_mode, stay_plan, bio, exam_type, is_verified_aspirant, created_at';

/** Connection-card columns (batch fetch by id). */
const CARD_COLS =
  'id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, ' +
  'phone_last3, travel_mode, stay_plan, bio';

/** Seeded connection-card columns (seeded_users has no `plus_member`). */
const SEEDED_CARD_COLS =
  'id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, ' +
  'phone_last3, travel_mode, stay_plan, bio';

/** Upsert payload — `phone` is the conflict key and is required. */
export type UpsertUserPayload = Partial<User> & { phone: string };

// ─── Lookup / profile ─────────────────────────────────────────────────────────

/**
 * Lightweight lookup by phone — powers the status/exam root guard (qk.status).
 * `maybeSingle`, so `data` is `null` when no user exists for the phone.
 */
export function getUserByPhone(phone: string): Promise<ApiResult<UserLookup>> {
  return query<UserLookup>(
    supabase.from('users').select(LOOKUP_COLS).eq('phone', phone).maybeSingle(),
  );
}

/**
 * The FULL self profile row (qk.profile). `maybeSingle` → `null` when absent.
 * Never use a partial projection to populate this key.
 */
export function getProfileByPhone(phone: string): Promise<ApiResult<User>> {
  return query<User>(
    supabase.from('users').select(PROFILE_COLS).eq('phone', phone).maybeSingle(),
  );
}

/** Insert-or-update a user row (conflict key: `phone`). Returns `{ id }`. */
export function upsertUser(payload: UpsertUserPayload): Promise<ApiResult<{ id: string }>> {
  return query<{ id: string }>(
    supabase.from('users').upsert(payload, { onConflict: 'phone' }).select('id').single(),
  );
}

// ─── Feed sources ──────────────────────────────────────────────────────────────

/**
 * Real users for the Find Mates feed, scoped to an exam ecosystem.
 *  - `'NEET UG'` (default): also includes legacy rows with `exam_type IS NULL`.
 *  - Any other exam: strict equality (segregates NEET PG etc.).
 * Excludes incomplete, paused, and admin-suspended/banned profiles.
 */
export function getAllUsers(examType: ExamType | null = 'NEET UG'): Promise<ApiResult<FeedUser[]>> {
  let q = supabase
    .from('users')
    .select(FEED_COLS)
    .eq('profile_completed', true)
    .or('is_profile_paused.is.null,is_profile_paused.eq.false')
    .or('account_status.is.null,account_status.eq.active');

  if (!examType || examType === 'NEET UG') {
    q = q.or('exam_type.eq.NEET UG,exam_type.is.null');
  } else {
    q = q.eq('exam_type', examType);
  }

  return query<FeedUser[]>(q.order('created_at', { ascending: false }));
}

/**
 * Seeded/demo profiles for the feed (separate `seeded_users` table). Same exam
 * scoping as {@link getAllUsers}; RLS handles paused/inactive rows live.
 */
export function getSeededUsers(examType: ExamType | null = 'NEET UG'): Promise<ApiResult<FeedUser[]>> {
  let q = supabase.from('seeded_users').select(SEEDED_FEED_COLS);
  if (!examType || examType === 'NEET UG') {
    q = q.or('exam_type.eq.NEET UG,exam_type.is.null');
  } else {
    q = q.eq('exam_type', examType);
  }
  return query<FeedUser[]>(q.order('created_at', { ascending: false }));
}

/**
 * Batch-fetch user cards by id (connection counterparts). Resolves to an empty
 * list without a network call for empty input — matching web.
 */
export function getUsersByIds(ids: string[]): Promise<ApiResult<FeedUser[]>> {
  if (!ids || ids.length === 0) return Promise.resolve({ data: [], error: null });
  return query<FeedUser[]>(supabase.from('users').select(CARD_COLS).in('id', ids));
}

/**
 * Batch-fetch seeded/demo cards by id — the fallback for connection counterparts
 * that are not in the `users` table (mirrors the seeded lookup in web
 * `js/connections.js`). Empty input resolves without a network call.
 */
export function getSeededUsersByIds(ids: string[]): Promise<ApiResult<FeedUser[]>> {
  if (!ids || ids.length === 0) return Promise.resolve({ data: [], error: null });
  return query<FeedUser[]>(supabase.from('seeded_users').select(SEEDED_CARD_COLS).in('id', ids));
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/** User submits Roll Number and requests admit-card verification. Returns `{ id }`. */
export function requestAdmitCardVerification(
  phone: string,
  ntaNumber: string,
): Promise<ApiResult<{ id: string }>> {
  return query<{ id: string }>(
    supabase
      .from('users')
      .update({
        nta_application_number: ntaNumber.trim(),
        verification_requested: true,
        verification_rejected: false,
      })
      .eq('phone', phone)
      .select('id')
      .single(),
  );
}

/** Pause / unpause the current user's profile (hides/shows them in the feed). */
export function setPausedStatus(phone: string, paused: boolean): Promise<ApiResult<{ id: string }>> {
  return query<{ id: string }>(
    supabase.from('users').update({ is_profile_paused: paused }).eq('phone', phone).select('id').single(),
  );
}

/** Save the device fingerprint on the user row (multi-account detection). */
export function saveDeviceFingerprint(userId: string, fingerprint: string): Promise<ApiResult<null>> {
  return query<null>(
    supabase.from('users').update({ device_fingerprint: fingerprint }).eq('id', userId),
  );
}

/**
 * Acknowledge the one-time suspension warning: clears `suspension_warning`
 * server-side so it never shows again (Story 8.3, FR-31). Ports
 * `dismissSuspensionWarning` from web `js/supabase.js` — RPC
 * `dismiss_suspension_warning`, param `p_user_id`.
 */
export function dismissSuspensionWarning(userId: string): Promise<ApiResult<null>> {
  return query<null>(supabase.rpc('dismiss_suspension_warning', { p_user_id: userId }));
}

/**
 * Delete all of a user's data: connections first (FK), then the profile row.
 * Aborts and returns the connections error if that first delete fails.
 */
export async function deleteUserData(userId: string): Promise<ApiResult<null>> {
  const conn = await query<null>(
    supabase.from('connections').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  );
  if (conn.error) return { data: null, error: conn.error };
  return query<null>(supabase.from('users').delete().eq('id', userId));
}
