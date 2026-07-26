/**
 * "Who am I" as a user id (Epic 4). The app-wide handle is the Firebase phone
 * (E.164), but connections/requests key on the resolved Supabase user id.
 *
 * Sourced from `useProfile(phone)` = qk.profile (the FULL self record), NOT
 * qk.status: qk.profile has a single queryFn everywhere (`getProfileByPhone`), so
 * mounting this hook in many feed cards can never fight `useFeed`'s qk.status
 * observer over the cache shape. All callers share the one cached profile query
 * (deduped, already warm from boot), so it costs no extra network.
 */
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';

export function useMyUserId(): string | null {
  const { phone } = useSession();
  const { data } = useProfile(phone);
  return data?.id ?? null;
}
