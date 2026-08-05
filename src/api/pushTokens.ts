/**
 * Device push-token registration (Expo push service). One row per install;
 * `token` is globally unique so re-registering the same device (reinstall,
 * re-sign-in as a different user) just re-associates it via upsert.
 */
import { supabase } from './client';
import { env } from '@/lib/env';

export const EDGE_BASE = `${env.supabaseUrl}/functions/v1`;

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T | null; error: ApiError | null };

function toApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): ApiError | null {
  if (!err) return null;
  const e = err as { code?: string; message?: string };
  return { code: e.code ?? 'unknown', message: e.message ?? fallback };
}

export async function upsertDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android',
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('device_tokens')
      .upsert({ user_id: userId, token, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
    return { data: null, error: toApiError(error) };
  } catch (err) {
    return { data: null, error: toApiError(err) };
  }
}
