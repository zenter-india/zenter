import { supabase } from '@/api';

/**
 * Block / unblock data-access layer (AD-1). Direct port of the block helpers in
 * the live web `js/supabase.js` (`blocked_users` table). Feature code imports
 * these by direct path (`@/api/blocked`); the block/unblock UI wraps them via
 * `src/data/useBlocked.ts`.
 *
 * Every function resolves to the universal `{ data, error }` contract and never
 * throws — mirroring the web `query()` wrapper. Errors are normalized to
 * `{ code, message }` so the UI can surface a stable message (AD-12).
 */

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T | null; error: ApiError | null };

/** Row shape returned by {@link getBlockedList} (Blocked Users page). */
export type BlockedListRow = {
  id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
};

/** `{ blocked_user_id }` — users the current user has blocked. */
export type BlockedUserIdRow = { blocked_user_id: string };

/** `{ blocker_user_id }` — users who have blocked the current user. */
export type BlockedByIdRow = { blocker_user_id: string };

/**
 * Minimum block-reason length enforced by the block UI (the modal disables its
 * confirm button below this). The web live-validation constant; the `blockUser`
 * insert itself does NOT enforce a minimum — it trims to a non-empty string or
 * stores `null`.
 */
export const MIN_BLOCK_REASON_LEN = 4;

/** Normalize any Supabase/network error to `{ code, message }` (mirrors web `toUiError`). */
function toUiError(err: unknown, fallback = 'Something went wrong. Please try again.'): ApiError | null {
  if (!err) return null;
  const e = err as { message?: string; error_description?: string; hint?: string; code?: string };
  return {
    code: e.code || 'unknown',
    message: e.message || e.error_description || e.hint || fallback,
  };
}

/**
 * Await any PostgREST builder / RPC and resolve to `{ data, error }` — never
 * throws (mirrors the web `query()` wrapper). The Supabase client is untyped
 * (anon key, no generated Database types), so the caller supplies the row type.
 */
async function query<T>(builder: PromiseLike<{ data: unknown; error: unknown }>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await builder;
    return { data: (data ?? null) as T | null, error: error ? toUiError(error) : null };
  } catch (err) {
    return { data: null, error: toUiError(err) };
  }
}

/**
 * Block a user. Trims the reason to a non-empty string or stores `null` — the
 * insert imposes no minimum length (that is a UI concern; see
 * {@link MIN_BLOCK_REASON_LEN}). Ports `blockUser` from `js/supabase.js`.
 */
export function blockUser(
  myId: string,
  userId: string,
  reason: string | null = null,
): Promise<ApiResult<{ id: string }>> {
  return query<{ id: string }>(
    supabase
      .from('blocked_users')
      .insert({
        blocker_user_id: myId,
        blocked_user_id: userId,
        reason: reason && String(reason).trim() ? String(reason).trim() : null,
      })
      .select('id')
      .single(),
  );
}

/** Remove a block. Ports `unblockUser` from `js/supabase.js`. */
export function unblockUser(myId: string, blockedId: string): Promise<ApiResult<null>> {
  return query<null>(
    supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_user_id', myId)
      .eq('blocked_user_id', blockedId),
  );
}

/** Full block list with reason + timestamps for the Blocked Users page. Ports `getBlockedList`. */
export function getBlockedList(myId: string): Promise<ApiResult<BlockedListRow[]>> {
  return query<BlockedListRow[]>(
    supabase
      .from('blocked_users')
      .select('id, blocked_user_id, reason, created_at')
      .eq('blocker_user_id', myId)
      .order('created_at', { ascending: false }),
  );
}

/** IDs of every user blocked by `myId` — used to filter them out of the feed. Ports `getBlockedUserIds`. */
export function getBlockedUserIds(myId: string): Promise<ApiResult<BlockedUserIdRow[]>> {
  return query<BlockedUserIdRow[]>(
    supabase
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('blocker_user_id', myId),
  );
}

/**
 * IDs of users who have blocked `myId` — used to hide the blocker from the
 * blocked user's feed so neither side sees the other. Ports `getBlockedByIds`.
 */
export function getBlockedByIds(myId: string): Promise<ApiResult<BlockedByIdRow[]>> {
  return query<BlockedByIdRow[]>(
    supabase
      .from('blocked_users')
      .select('blocker_user_id')
      .eq('blocked_user_id', myId),
  );
}

/**
 * Delete ALL connection rows between two users (either direction, any status)
 * so the relationship disappears immediately on block/unblock. Ports
 * `deleteConnectionsBetween`. Callers treat its error as non-fatal.
 *
 * Uses explicit OR conditions to match only rows where the pair [a,b] appear
 * as (sender→receiver) OR (receiver→sender) — avoiding an unintended
 * Cartesian product from double `.in()`:
 *   (a→b) OR (b→a)
 */
export function deleteConnectionsBetween(a: string, b: string): Promise<ApiResult<null>> {
  return query<null>(
    supabase
      .from('connections')
      .delete()
      .or(
        `and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`,
      ),
  );
}
