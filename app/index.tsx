import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { BootSplash } from '@/features/auth/BootSplash';
import { resolvePostOnboardingRoute } from '@/features/auth/routing';
import { isLiveExam } from '@/domain/gating';

/**
 * Gated boot (Story 2.2, FR-3/FR-4). Single source of launch routing:
 *   - session not resolved → splash (no auth flash for returning members)
 *   - no session          → welcome (pitch screen, then sign-in)
 *   - session, profile loading → splash
 *   - profile incomplete OR fetch error → onboarding (fail-safe, matches web)
 *   - profile complete     → a pending deep-link target, else the feed
 * All redirects replace, so the boot/auth entry never sits in the back stack.
 */
export default function Boot() {
  const { user, phone, ready } = useSession();
  const profile = useProfile(phone);

  if (!ready) return <BootSplash />;
  if (!user || !phone) return <Redirect href="/(auth)/welcome" />;
  if (profile.isLoading) return <BootSplash />;

  const completed = !profile.isError && profile.data?.profile_completed === true;
  if (!completed) return <Redirect href="/onboarding" />;

  // Suspension lockout (Story 8.3, FR-30): a suspended member is held at the
  // full-screen Suspended gate before any feed/exam/deep-link routing — the
  // cold-start counterpart to the always-mounted SuspensionGate (foreground).
  if (profile.data?.account_status === 'suspended') return <Redirect href="/suspended" />;

  // Exam gate (Story 3.1, FR-9): an onboarded member whose exam isn't live is
  // held at Maintenance before any deep link is replayed — so the gate can't be
  // bypassed via a stored deep link. Mirrors web `LIVE_EXAMS` (null → 'NEET UG').
  if (!isLiveExam(profile.data?.exam_type ?? 'NEET UG')) return <Redirect href="/maintenance" />;

  return <OnboardedRedirect />;
}

/**
 * Resolve where an onboarded member lands: a stored deep link (replayed once) or
 * the feed. Split into its own component so the async resolution can use hooks
 * without violating the parent's early-return branches.
 */
function OnboardedRedirect() {
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    let alive = true;
    resolvePostOnboardingRoute().then((t) => {
      if (alive) setTarget(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!target) return <BootSplash />;
  return <Redirect href={target} />;
}
