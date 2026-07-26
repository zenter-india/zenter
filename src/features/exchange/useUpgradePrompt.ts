/**
 * Upgrade CTA behaviour (Epic 7 / Story 7.1). Routes the user to the Zenter
 * Plus subscription screen (`/plus`) and tracks the documented
 * `upgrade_cta_click` analytics event. The `source` distinguishes where the
 * tap came from (`chat_locked` / `free_chat_banner`), mirroring the web
 * `trackEvent('upgrade_cta_click', …)`.
 */
import { router } from 'expo-router';
import { track } from '@/lib/observability';

/** Returns an onPress handler that tracks the CTA and navigates to Plus. */
export function useUpgradePrompt(source: string): () => void {
  return () => {
    track('upgrade_cta_click', { source });
    router.push('/plus');
  };
}

