/**
 * The universal `{ data, error }` contract for the data-access layer (AD-1),
 * ported verbatim from web `js/supabase.js` (`toUiError` + `query`). Every
 * function in `src/api/*` resolves to {@link ApiResult} and NEVER throws — the
 * throwing happens one layer up in `src/data/*` hooks (via {@link unwrap}) so
 * TanStack Query / AsyncBoundary can surface it.
 *
 * Shared by all api modules; import by direct path: `import { query } from '@/api/result'`.
 */

export type ApiError = { code: string; message: string };

/** `data` is `T | null` because PostgREST returns `null` on error and on empty
 *  `maybeSingle()` reads. */
export type ApiResult<T> = { data: T | null; error: ApiError | null };

/** Any Supabase PostgREST builder or `rpc()` call — a thenable resolving to a
 *  `{ data, error }` envelope (extra fields like `count`/`status` are ignored).
 *  Input is intentionally untyped in `data`: supabase-js builders carry a complex
 *  branded generic that does not structurally match `T | null`; the caller asserts
 *  the row shape via `query<T>(...)` and gets a typed `ApiResult<T>` back. */
type SupabaseThenable = PromiseLike<{ data: unknown; error: unknown }>;

/** Normalize a Supabase/Postgres error to `{ code, message }`, or `null`. */
export function toUiError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): ApiError | null {
  if (!err) return null;
  const e = err as { message?: string; error_description?: string; hint?: string; code?: string };
  return {
    code: e.code || 'unknown',
    message: e.message || e.error_description || e.hint || fallback,
  };
}

/**
 * Await a Supabase builder and coerce it to {@link ApiResult}. Catches both
 * returned errors and thrown exceptions. Mirrors web `query()`.
 */
export async function query<T>(builder: SupabaseThenable): Promise<ApiResult<T>> {
  try {
    const { data, error } = await builder;
    return { data: (data as T | null) ?? null, error: error ? toUiError(error) : null };
  } catch (err) {
    return { data: null, error: toUiError(err) };
  }
}

/**
 * Bridge from the non-throwing api contract to the throwing hook contract:
 * throws `error.message` (so it surfaces in `useQuery`/AsyncBoundary), otherwise
 * returns `data` (which may legitimately be `null`, e.g. a `maybeSingle()` miss).
 */
export function unwrap<T>(result: ApiResult<T>): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
