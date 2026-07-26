import {
  getAuth,
  signInWithPhoneNumber,
  type ConfirmationResult as ModularConfirmationResult,
  type UserCredential,
} from '@react-native-firebase/auth';

/**
 * Native Firebase Phone-OTP wrapper (data:firebase-otp).
 *
 * Ports the web sign-in flow (d:/zenter/js/login.js + firebase-config.js) to
 * React Native. On native, @react-native-firebase/auth handles device
 * verification via Play Integrity / SafetyNet (Android) and silent APNs push
 * (iOS), so there is NO reCAPTCHA and no ApplicationVerifier to construct —
 * `signInWithPhoneNumber(e164)` is called directly. Firebase is the sole
 * identity system (AD-4); `phone` (E.164) is the app-wide user handle.
 *
 * Common failure causes:
 *  1. SHA-1/SHA-256 fingerprint not registered in Firebase Console
 *  2. Phone Auth provider not enabled in Firebase Console
 *  3. Play Integrity API not enabled in Google Cloud Console
 *  4. google-services.json out of date (missing fingerprint)
 *  5. Firebase quota exceeded for phone auth
 */

/** Mirrors the web SDK ConfirmationResult shape: `{ confirm(code) }`. */
export type ConfirmationResult = ModularConfirmationResult;

/**
 * Start phone auth: send an OTP to an already-normalized E.164 number and
 * return the ConfirmationResult used to verify the code. The caller must
 * normalize with normalizePhoneIN() first (mirrors login.js sendOtp()).
 */
export async function startPhoneAuth(e164: string): Promise<ConfirmationResult> {
  try {
    const confirmation = await signInWithPhoneNumber(getAuth(), e164);
    return confirmation;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    // Log full error details for debugging — visible in Metro/Logcat/Xcode
    console.error('[firebasePhone] startPhoneAuth failed', { code, message, e164, raw: err });
    throw err;
  }
}

/**
 * Verify the 6-digit OTP against the pending confirmation. Resolves to the
 * Firebase user credential on success; rejects with a Firebase auth error
 * (`.code`) that mapAuthError() turns into user-facing copy.
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserCredential | null> {
  try {
    return await confirmation.confirm(code);
  } catch (err: unknown) {
    const errCode = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    console.error('[firebasePhone] confirmOtp failed', { code: errCode, message, raw: err });
    throw err;
  }
}

/**
 * Normalize an Indian mobile number to +91 E.164, or null if invalid.
 * Ported EXACT from d:/zenter/js/utils.js normalizePhoneIN():
 *   - 10 digits starting 6-9        -> +91XXXXXXXXXX
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
 * Map a Firebase auth error code to user-facing copy.
 * Messages ported EXACT from d:/zenter/js/login.js toMessage(). The
 * reCAPTCHA-specific `auth/captcha-check-failed` entry is intentionally
 * dropped — native phone auth has no reCAPTCHA. Unknown/undefined codes fall
 * back to the generic message.
 *
 * Native-specific codes added:
 *  - auth/app-not-authorized: SHA fingerprint not registered in Firebase Console
 *  - auth/missing-client-identifier: Play Integrity / SafetyNet not configured
 *  - auth/internal-error: generic native failure (check Logcat for root cause)
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'Invalid phone number. Use 10 digits without country code.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/invalid-verification-code': 'Incorrect code. Please check and try again.',
  'auth/code-expired': 'Code expired. Request a new one.',
  'auth/missing-phone-number': 'Enter your mobile number.',
  'auth/quota-exceeded': 'SMS quota exceeded. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/user-disabled': 'This account has been disabled.',
  // Native-only errors
  'auth/app-not-authorized':
    'App not authorised for phone sign-in. Please contact support.',
  'auth/missing-client-identifier':
    'Device verification unavailable. Please try again or contact support.',
  'auth/internal-error':
    'A sign-in error occurred. Please try again. If this persists, contact support.',
};

export function mapAuthError(code: string | undefined | null): string {
  return (code && AUTH_ERROR_MESSAGES[code]) || 'Something went wrong. Please try again.';
}
