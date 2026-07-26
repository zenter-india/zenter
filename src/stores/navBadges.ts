import { useSyncExternalStore } from 'react';

/**
 * Tiny external store for the bottom-tab count badges (Requests, Chats).
 * Feature epics push real counts here (Epic 4 requests, Epic 5 unread); the tab
 * layout subscribes. Kept framework-light; migrates to Zustand alongside 1.4 if needed.
 */
type Badges = { requests?: number; chats?: number };
let state: Badges = {};
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export const navBadges = {
  set(patch: Partial<Badges>) {
    state = { ...state, ...patch };
    emit();
  },
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useNavBadges(): Badges {
  return useSyncExternalStore(navBadges.subscribe, navBadges.get, navBadges.get);
}
