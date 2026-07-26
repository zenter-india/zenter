/**
 * Shared navigation targets for the connections flow (Epic 4). The "Open Chat"
 * CTA (feed card, mate sheet, connection row) and the post-accept safety
 * acknowledgement all land the member on the Chats tab — Epic 5 will refine this
 * to open a specific thread. Ported from the web `activateTab('chats')` behaviour.
 */
import { router, type Href } from 'expo-router';

/** The Chats tab. Cast like the other route constants in `features/auth/routing.ts`. */
export const CHATS_ROUTE = '/chats' as Href;

/** Switch to the Chats tab (dismisses any presented sheet/modal as a side effect). */
export function goToChats(): void {
  router.navigate(CHATS_ROUTE);
}
