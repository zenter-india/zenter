import * as Linking from 'expo-linking';
import { storage, STORAGE_KEYS } from '@/lib/storage';

/**
 * Deep-link continuity (FR-35, AD-3). A link received while logged-out is stored
 * and replayed after the next successful authentication (post-OTP for onboarded
 * users, or post-onboarding for new users). Links into the auth/onboarding/boot
 * shell are never stored — those are not real destinations.
 *
 * NOTE (v1 limitation): capturing a cold-start deep link relies on
 * {@link useDeepLinkCapture} being mounted high in the tree. The per-target-screen
 * root guard that would hold the link *before* a gated screen paints (AD-10)
 * lands with those screens' epics; here we provide the store + replay mechanism.
 */

/** Path segments that are shell/gate routes, never a stored deep-link target. */
const NON_TARGET_PREFIXES = ['(auth)', 'sign-in', 'otp', 'onboarding'];

/**
 * Turn a full deep-link URL into an in-app path (e.g. `zenter://chat/123?x=1` →
 * `/chat/123?x=1`). Returns `null` for links that resolve to the auth/onboarding
 * shell or have no path (nothing worth replaying).
 */
export function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: ReturnType<typeof Linking.parse>;
  try {
    parsed = Linking.parse(url);
  } catch {
    return null;
  }
  const rawPath = (parsed.path ?? '').replace(/^\/+/, '');
  if (!rawPath) return null;

  const firstSeg = rawPath.split('/')[0] ?? '';
  if (NON_TARGET_PREFIXES.includes(firstSeg)) return null;

  const qp = parsed.queryParams ?? {};
  const query = Object.entries(qp)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return `/${rawPath}${query ? `?${query}` : ''}`;
}

/** Persist a pending deep-link target (best-effort; ignores non-targets). */
export async function storePendingDeepLink(url: string | null | undefined): Promise<void> {
  const path = pathFromUrl(url);
  if (!path) return;
  await storage.setString(STORAGE_KEYS.pendingDeepLink, path);
}

/**
 * Read and clear the pending deep-link target. Returns the stored in-app path, or
 * `null` if none is pending. Single-use — consumed on the first authenticated
 * landing so it never replays twice.
 */
export async function takePendingDeepLink(): Promise<string | null> {
  const path = await storage.getString(STORAGE_KEYS.pendingDeepLink);
  if (path) await storage.remove(STORAGE_KEYS.pendingDeepLink);
  return path;
}
