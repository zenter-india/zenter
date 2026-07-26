/**
 * Account-management mutations for Epic 6 (Profile Management). These wrap the
 * dedicated `users` mutations in `src/api/users.ts` and keep the self caches in
 * sync (AD-2): both the FULL profile record (qk.profile) and the status/exam
 * guard projection (qk.status) are invalidated so every surface — the profile
 * screen, the feed gate, the root guard — re-reads the latest row.
 *
 * "Who am I" is the Firebase phone (E.164). All hooks throw on error via
 * `unwrap` so react-query / AsyncBoundary surface failures (AD-1). None are
 * optimistic — the web isn't optimistic for verify/pause/delete, so we simply
 * invalidate on success (unlike connections / chat-send).
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { unwrap } from '@/api/result';
import {
  requestAdmitCardVerification,
  setPausedStatus,
  deleteUserData,
  dismissSuspensionWarning,
} from '@/api/users';

/** Refresh both self-scoped caches after an account mutation. */
function invalidateSelf(qc: QueryClient, phone: string | null | undefined) {
  if (!phone) return;
  qc.invalidateQueries({ queryKey: qk.profile(phone) });
  qc.invalidateQueries({ queryKey: qk.status(phone) });
}

/**
 * Whether the signed-in member is a verified aspirant. Reads the FULL self
 * record (qk.profile) — the one cache that is never overwritten by a partial
 * fetch — so Epic 7 can gate the Contact-Exchange *request* on it without a
 * conversation in hand. (Inside a chat, `useExchange(convId).isVerified` exposes
 * the same flag.)
 */
export function useIsVerified(): boolean {
  const { phone } = useSession();
  return Boolean(useProfile(phone).data?.is_verified_aspirant);
}

/**
 * Submit a Roll Number and request admit-card verification (Story 6.2). The
 * caller enforces the min-length gate (see `MIN_ROLL_LEN`); this persists the
 * number and flips `verification_requested` on. Admins approve out-of-app.
 */
export function useRequestVerification(phone: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ntaNumber: string) => {
      if (!phone) throw new Error('Cannot read your phone number — please sign in again.');
      return unwrap(await requestAdmitCardVerification(phone, ntaNumber));
    },
    onSuccess: () => invalidateSelf(qc, phone),
  });
}

/**
 * Pause / reactivate the profile (Story 6.3). Pausing hides the member from
 * other feeds server-side; reactivating restores visibility. `is_profile_paused`
 * lives on the FULL record, so invalidating qk.profile flips the amber banner.
 */
export function usePauseProfile(phone: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paused: boolean) => {
      if (!phone) throw new Error('Cannot read your phone number — please sign in again.');
      return unwrap(await setPausedStatus(phone, paused));
    },
    onSuccess: () => invalidateSelf(qc, phone),
  });
}

/**
 * Delete the account (Story 6.3, FR-26/NFR-6): removes connections (FK first)
 * then the profile row. Keyed by DB user id. The caller signs the member out and
 * resets to the auth stack on success (no cache invalidation needed — `logout`
 * clears the whole query cache).
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (userId: string) => unwrap(await deleteUserData(userId)),
  });
}

/**
 * Acknowledge the one-time suspension warning (Story 8.3, FR-31). Clears the
 * server flag via `dismiss_suspension_warning` (keyed by DB user id) and refreshes
 * both self caches so the flag reads false and the warning never shows again.
 */
export function useDismissSuspensionWarning() {
  const qc = useQueryClient();
  const { phone } = useSession();
  return useMutation({
    mutationFn: async (userId: string) => unwrap(await dismissSuspensionWarning(userId)),
    onSuccess: () => invalidateSelf(qc, phone),
  });
}
