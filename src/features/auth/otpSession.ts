import { useSyncExternalStore } from 'react';
import type { ConfirmationResult } from './firebasePhone';

/**
 * Pending phone-OTP handoff between the sign-in and OTP screens (Story 2.1).
 *
 * The Firebase {@link ConfirmationResult} returned by `startPhoneAuth` is a live,
 * non-serializable object, so it cannot travel through Expo Router params. This
 * tiny external store (same pattern as `stores/navBadges`) carries it — plus the
 * E.164 phone for display + resend — from sign-in to the OTP screen. Cleared on
 * success or when the user changes the number.
 */
type OtpSessionState = {
  phone: string | null;
  confirmation: ConfirmationResult | null;
};

let state: OtpSessionState = { phone: null, confirmation: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const otpSession = {
  /** Store a fresh confirmation for a phone (sign-in success, or resend). */
  set(phone: string, confirmation: ConfirmationResult) {
    state = { phone, confirmation };
    emit();
  },
  /** Replace just the confirmation after a resend (phone unchanged). */
  setConfirmation(confirmation: ConfirmationResult) {
    state = { ...state, confirmation };
    emit();
  },
  get: () => state,
  clear() {
    state = { phone: null, confirmation: null };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Reactive read of the pending OTP handoff (for the OTP screen). */
export function useOtpSession(): OtpSessionState {
  return useSyncExternalStore(otpSession.subscribe, otpSession.get, otpSession.get);
}
