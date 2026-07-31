import { supabase } from '@/api/client';
import type { AuthError, Session } from '@supabase/supabase-js';

/**
 * Supabase Auth phone-OTP wrapper (replaces the former Firebase Phone Auth
 * module — see project history for why: Firebase's iOS silent-push device
 * verification is capped at Apple's low-priority background-delivery tier,
 * so it fell back to a reCAPTCHA web view too often to be usable. Supabase
 * Auth's phone provider, configured with Twilio Verify as the SMS backend,
 * has no such fallback — it's a direct SMS OTP send/check, same on iOS and
 * Android).
 *
 * `phone` (E.164) stays the app-wide user handle exactly as before — nothing
 * downstream of a successful verify (routing, profile lookups) needed to
 * change, since the backend was always phone-keyed, never Firebase-uid-keyed.
 */

/**
 * Send an OTP to an already-normalized E.164 number via Supabase Auth
 * (Twilio Verify under the hood). Caller must normalize with
 * normalizePhoneIN() first (mirrors the former sendOtp()/startPhoneAuth()).
 */
export async function startPhoneAuth(e164: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) {
    console.error('[phoneAuth] startPhoneAuth failed', { code: error.code, status: error.status, message: error.message, e164 });
    throw error;
  }
}

/**
 * Verify the 6-digit OTP for `phone`. On success, Supabase returns a real
 * session (access + refresh token) — already persisted by the client
 * (src/api/client.ts has persistSession/autoRefreshToken on). Also links this
 * auth session to the caller's existing `public.users` row (bridging the
 * pre-Supabase-Auth account by phone match) via `link_auth_account()`; this
 * is a no-op-safe, idempotent call and is skipped only if it errors, since a
 * genuinely new user has no existing row to link (onboarding's own insert
 * sets `auth_uid` in that case).
 */
export async function confirmOtp(phone: string, code: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) {
    console.error('[phoneAuth] confirmOtp failed', { code: error.code, status: error.status, message: error.message });
    throw error;
  }

  const { error: linkError } = await supabase.rpc('link_auth_account');
  if (linkError) {
    // Expected/harmless for a brand-new user (no existing public.users row to
    // link yet) — log only, never block sign-in on this.
    console.warn('[phoneAuth] link_auth_account failed (expected for new users)', linkError.message);
  }

  return data.session;
}

/**
 * Normalize an Indian mobile number to +91 E.164, or null if invalid.
 * Unchanged from the Firebase-era module — zero auth-provider dependency.
 *   - 10 digits starting 6-9         -> +91XXXXXXXXXX
 *   - 12 digits starting 91 then 6-9 -> +91XXXXXXXXXX
 * Everything else (incl. empty) -> null.
 */
export function normalizePhoneIN(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return `+${digits}`;
  return null;
}

/**
 * Map a Supabase Auth error to user-facing copy.
 *
 * BEST-EFFORT pending empirical verification (see project plan, Phase 5):
 * Supabase's `AuthApiError` doesn't expose as stable a code vocabulary as
 * Firebase's `auth/*` strings for phone-OTP specifically — this keys first on
 * `error.code` where GoTrue does supply one, then falls back to matching
 * `error.message` substrings (Supabase's messages are human-readable and
 * fairly stable, but confirm these against real responses once Twilio Verify
 * is live — see TODO markers).
 */
const AUTH_ERROR_CODES: Record<string, string> = {
  // TODO(verify): confirm these exact `error.code` values against a live
  // Supabase project with Twilio Verify configured.
  over_sms_send_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  sms_send_failed: 'Could not send the code. Please try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  otp_expired: 'Code expired. Request a new one.',
  invalid_credentials: 'Incorrect code. Please check and try again.',
  validation_failed: 'Invalid phone number. Use 10 digits without country code.',
};

const AUTH_ERROR_MESSAGE_PATTERNS: [RegExp, string][] = [
  [/invalid.*phone/i, 'Invalid phone number. Use 10 digits without country code.'],
  [/token.*expired|invalid/i, 'Incorrect or expired code. Please check and try again.'],
  [/rate limit|too many/i, 'Too many attempts. Please wait a moment and try again.'],
  [/network/i, 'Network error. Check your connection.'],
];

type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

export function mapAuthError(error: AuthErrorLike): string {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.code && AUTH_ERROR_CODES[error.code]) return AUTH_ERROR_CODES[error.code];
  const match = AUTH_ERROR_MESSAGE_PATTERNS.find(([re]) => re.test(error.message ?? ''));
  return match?.[1] ?? 'Something went wrong. Please try again.';
}

/** True when an error looks like a rate-limit response (drives the cooldown UX). */
export function isRateLimitError(error: AuthErrorLike): boolean {
  if (!error) return false;
  if (error.code === 'over_sms_send_rate_limit' || error.code === 'over_request_rate_limit') return true;
  return /rate limit|too many/i.test(error.message ?? '');
}
