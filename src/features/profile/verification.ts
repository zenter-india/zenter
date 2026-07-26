/**
 * Roll-Number verification — pure state derivation + documented copy (Story 6.2).
 *
 * Ported from the web `hydrateAll()` visibility rules in `js/profile.js`:
 *   verified  = is_verified_aspirant
 *   pending   = !verified && verification_requested
 *   rejected  = !verified && !pending && verification_rejected
 *   (else)    = unsubmitted
 * The submit/resubmit form shows for the `rejected` and `unsubmitted` states.
 *
 * Verification is set by admins OUT of the app (FR-24); the member can only
 * request it. Once verified, this same flag unlocks Contact Exchange (Epic 7) —
 * see `useIsVerified` in `src/data/useAccount.ts`.
 */
import type { User } from '@/types/user';

export type VerificationState = 'verified' | 'pending' | 'rejected' | 'unsubmitted';

/** Which verification state the profile is in (mirrors web `hydrateAll`). */
export function verificationState(
  u: Pick<User, 'is_verified_aspirant' | 'verification_requested' | 'verification_rejected'>,
): VerificationState {
  if (u.is_verified_aspirant) return 'verified';
  if (u.verification_requested) return 'pending';
  if (u.verification_rejected) return 'rejected';
  return 'unsubmitted';
}

/** The Roll-Number form is shown only when not verified and not pending. */
export function canSubmitVerification(state: VerificationState): boolean {
  return state === 'unsubmitted' || state === 'rejected';
}

/** Minimum Roll Number length — web `js/profile.js` rejects `ntaVal.length < 4`. */
export const MIN_ROLL_LEN = 4;

/**
 * Verification microcopy. Badge strings are the documented aspirant-facing copy
 * (EXPERIENCE.md §States: "⏳ Pending review" / "✗ Not verified — resubmit") kept
 * verbatim including their emoji. The success toast strips the web HTML badge.
 */
export const VERIFICATION_COPY = {
  sectionTitle: 'Roll No Verification',
  encourage:
    'Verify your Roll Number as on your admit card to earn the ✓ Verified badge and unlock contact exchange.',
  inputLabel: 'Roll Number',
  inputPlaceholder: 'Enter Roll Number',
  submitCta: 'Get Verified',
  invalidRoll: 'Please enter a valid Roll Number.',
  submitSuccess:
    "Request submitted. We'll review your details and mark your profile Verified shortly.",
  submitFallback: 'Could not submit. Please try again.',
  verifiedBadge: '✓ Roll No verified',
  pendingBadge: '⏳ Pending review',
  pendingHint: "We'll verify your Roll No shortly.",
  rejectedBadge: '✗ Not verified — resubmit',
  rejectedHint: 'Resubmit with the correct Roll Number.',
} as const;
