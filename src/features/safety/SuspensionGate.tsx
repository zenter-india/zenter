/**
 * Root suspension guard (Story 8.3, FR-30/FR-31, AD-10). Mounted once at the app
 * root (app/_layout.tsx) so it enforces account status across EVERY surface —
 * tabs, pushed screens, and deep-link targets alike.
 *
 * Behaviour:
 *   - Suspended → imperatively `router.replace('/suspended')` and pull the member
 *     back there on any navigation (a deep link that lands elsewhere is immediately
 *     overridden), so the lockout is unbypassable.
 *   - suspension_warning → render the one-time {@link SuspensionWarning} over the
 *     app; acknowledging clears the flag server-side via `dismiss_suspension_warning`.
 *   - runs "on fetch and foreground": the profile query is the fetch, and the gate
 *     invalidates it on app-foreground so a suspension applied while backgrounded is
 *     caught on resume.
 *
 * Source of truth = `useProfile(phone)` (qk.profile, the FULL self record). We
 * deliberately do NOT read `useAccountStatus` (qk.status) here: qk.status is a
 * shared key that `useFeed` also writes with an incompatible (raw UserLookup)
 * shape, and mounting an always-on qk.status observer at the root would activate
 * that dormant conflict — a security gate must never fail open, and it must not
 * risk corrupting the feed's `me`. qk.profile has a single consistent queryFn
 * everywhere, so it is both authoritative and conflict-free.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { router, usePathname } from 'expo-router';
import { qk } from '@/data/keys';
import { queryClient } from '@/data/queryClient';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useDismissSuspensionWarning } from '@/data/useAccount';
import { SuspensionWarning } from './SuspensionWarning';

const SUSPENDED_ROUTE = '/suspended';

export function SuspensionGate() {
  const { phone } = useSession();
  const profile = useProfile(phone);
  const dismiss = useDismissSuspensionWarning();
  const pathname = usePathname();

  const me = profile.data;
  const suspended = !!phone && me?.account_status === 'suspended';
  const warned = !!phone && me?.suspension_warning === true && !suspended;
  const myId = me?.id ?? null;

  // Re-check on foreground (AD-10): the profile query has no realtime push and is
  // not in the shared foreground-refresh set, so invalidate it ourselves on resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && phone) {
        queryClient.invalidateQueries({ queryKey: qk.profile(phone) });
      }
    });
    return () => sub.remove();
  }, [phone]);

  // Suspended lockout: replace the whole stack with /suspended and re-assert it on
  // every route change while suspended (unbypassable, deep links included).
  useEffect(() => {
    if (suspended && pathname !== SUSPENDED_ROUTE) {
      router.replace(SUSPENDED_ROUTE);
    }
  }, [suspended, pathname]);

  // Local ack guard so the warning hides on tap and never flashes again while the
  // clearing RPC + refetch are in flight; re-arms only if a fresh warning arrives.
  const [acked, setAcked] = useState(false);
  const [prevWarned, setPrevWarned] = useState(warned);
  if (warned !== prevWarned) {
    setPrevWarned(warned);
    if (warned) setAcked(false);
  }

  return (
    <SuspensionWarning
      visible={warned && !acked}
      busy={dismiss.isPending}
      onAcknowledge={() => {
        setAcked(true);
        if (myId) dismiss.mutate(myId);
      }}
    />
  );
}
