import type { Href } from 'expo-router';
import { getUserByPhone } from '@/api/users';
import { takePendingDeepLink } from './deepLink';

/**
 * Post-authentication routing (FR-3, Story 2.2), ported from `handlePostLogin`
 * in web `js/auth.js`:
 *   - profile-complete  → a stored deep-link target, else Find Aspirants
 *   - profile-incomplete → onboarding (the pending deep link is preserved and
 *     replayed only once the user becomes a full member)
 *   - ANY error         → onboarding (fail safe, matching web)
 *
 * The pending deep link is consumed here ONLY for already-onboarded users so a
 * brand-new user's link survives until {@link resolvePostOnboardingRoute}.
 */
export const FEED_ROUTE = '/feed' as Href;
export const ONBOARDING_ROUTE = '/onboarding' as Href;
export const SIGN_IN_ROUTE = '/(auth)/sign-in' as Href;

/** Where a just-verified user should land, given their phone (E.164). */
export async function resolvePostAuthRoute(phone: string): Promise<Href> {
  let completed = false;
  try {
    const { data, error } = await getUserByPhone(phone);
    completed = !error && data?.profile_completed === true;
  } catch {
    completed = false; // any failure → onboarding (AC 2.2)
  }
  if (!completed) return ONBOARDING_ROUTE;
  return resolvePostOnboardingRoute();
}

/**
 * Where a now-onboarded user should land: a stored deep-link target if one is
 * pending, else the feed. Used after OTP (already-onboarded) and after the
 * onboarding save completes.
 */
export async function resolvePostOnboardingRoute(): Promise<Href> {
  const pending = await takePendingDeepLink();
  return (pending ?? FEED_ROUTE) as Href;
}
