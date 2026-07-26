import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useSession } from '@/stores/session';
import { storePendingDeepLink } from './deepLink';

/**
 * Root-mounted, render-nothing capture for deep-link continuity (FR-35).
 *
 * While the session has resolved to logged-out, any incoming deep link (cold
 * start via `Linking.useURL()`'s initial value, or a live `url` event) is stashed
 * as the pending target. The gated boot / post-auth routing replays it after the
 * next successful authentication. When a session exists we do nothing — the app's
 * own navigation owns in-app links.
 */
export function DeepLinkCapture() {
  const url = Linking.useURL();
  const { user, ready } = useSession();

  useEffect(() => {
    if (!url || !ready || user) return;
    void storePendingDeepLink(url);
  }, [url, ready, user]);

  return null;
}
