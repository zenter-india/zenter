/**
 * platform_config reads (AD-1). Ported from getPlatformConfig() in
 * js/supabase.js — a flat SELECT of key/value rows. Value parsing into a typed
 * config object lives in the data layer (src/data/useConfig.ts), mirroring how
 * js/dashboard.js reads the raw rows and derives limits/toggles.
 *
 * platform_config.value is JSONB, so supabase-js returns already-parsed JS
 * values (number / boolean / string / null).
 */
import { supabase } from './client';

/** A single platform_config row. */
export interface ConfigRow {
  key: string;
  value: unknown;
}

/** Normalized API error, mirroring toUiError() in js/supabase.js. */
export interface ApiError {
  code: string;
  message: string;
}

/** Every api/* function resolves to this — never throws (AD-1). */
export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

function toApiError(
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
 * Read all platform_config key/value rows. Consumers (useConfig) parse the keys
 * they care about:
 *   - free_active_chats  (number, legacy fallback free_reveal_limit, default 2)
 *   - plus_enabled       (boolean, default true)
 *   - seeded_users_visible        (boolean, default true)
 *   - seeded_exam_centre_visible  (boolean, default true)
 */
export async function getPlatformConfig(): Promise<ApiResult<ConfigRow[]>> {
  try {
    const { data, error } = await supabase.from('platform_config').select('key, value');
    if (error) return { data: null, error: toApiError(error) };
    return { data: (data ?? []) as ConfigRow[], error: null };
  } catch (err) {
    return { data: null, error: toApiError(err) };
  }
}
