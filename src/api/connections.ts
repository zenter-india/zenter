/**
 * Connections + relationship backend surface (AD-1). Ported 1:1 from the live
 * web `js/supabase.js` connection helpers. Every function is async and resolves
 * to `{ data, error }` (never throws) — the data hooks in `src/data` decide when
 * to throw. Import this module by direct path; it is not re-exported from the
 * `@/api` barrel (avoids merge conflicts across parallel feature work).
 */
import { supabase } from './client';
import type { ConnectionRow } from '@/domain/relationships';

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T | null; error: ApiError | null };

/** Mirrors web `toUiError` — normalises a Supabase/Postgrest error, or null. */
function toApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): ApiError | null {
  if (!err) return null;
  const e = err as { code?: string; message?: string; error_description?: string; hint?: string };
  return { code: e.code ?? 'unknown', message: e.message ?? e.error_description ?? e.hint ?? fallback };
}

type SupaResult<T> = { data: T | null; error: unknown };

/** Mirrors web `query()` — awaits a Supabase builder/RPC and uniforms the result. */
async function run<T>(exec: () => PromiseLike<SupaResult<T>>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await exec();
    return { data: data ?? null, error: toApiError(error) };
  } catch (err) {
    return { data: null, error: toApiError(err) };
  }
}

/** Row returned by `.select('id')` inserts/updates. */
type IdRow = { id: string };

/**
 * All connection rows where the user is sender OR receiver, status in
 * `['pending','accepted','rejected']`. Feeds `domain/relationships.hydrate()`.
 */
export function getMyConnections(userId: string): Promise<ApiResult<ConnectionRow[]>> {
  return run<ConnectionRow[]>(() =>
    supabase
      .from('connections')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .in('status', ['pending', 'accepted', 'rejected']),
  );
}

/** Send a connection request (sender → receiver). Inserts a `pending` row. */
export function sendConnectionRequest(senderId: string, receiverId: string): Promise<ApiResult<IdRow>> {
  return run<IdRow>(() =>
    supabase
      .from('connections')
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id')
      .single(),
  );
}

/** Accept or reject a received request. Sets status + `updated_at`. */
export function respondToRequest(
  connectionId: string,
  status: 'accepted' | 'rejected',
): Promise<ApiResult<IdRow>> {
  return run<IdRow>(() =>
    supabase
      .from('connections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', connectionId)
      .select('id')
      .single(),
  );
}

/** Cancel/withdraw a request by deleting the row. */
export function deleteRequest(connectionId: string): Promise<ApiResult<null>> {
  return run<null>(() =>
    supabase.from('connections').delete().eq('id', connectionId),
  );
}

/**
 * Create the conversation for an accepted connection. RPC is idempotent
 * (orders users a<b, `ON CONFLICT (connection_id) DO NOTHING`, then returns the
 * existing/new conversation id). Call after `respondToRequest(_, 'accepted')`.
 */
export function createConversation(
  connectionId: string,
  userA: string,
  userB: string,
): Promise<ApiResult<string>> {
  return run<string>(() =>
    supabase.rpc('create_conversation_for_connection', {
      p_connection_id: connectionId,
      p_user_a: userA,
      p_user_b: userB,
    }),
  );
}

/** Count of active conversations the user participates in (RPC, STABLE). */
export function getActiveChatCount(userId: string): Promise<ApiResult<number>> {
  return run<number>(() =>
    supabase.rpc('get_active_chat_count', { p_user_id: userId }),
  );
}
