import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { queryClient } from '@/data/queryClient';

/**
 * Re-evaluate account status, config, and social state whenever the app
 * returns to foreground (AD-10): suspensions and platform config are
 * enforced on foreground, not just cold start, and requests/connections/
 * conversations have no realtime push of their own (unlike an open chat
 * thread's own AppState listener in useMessages.ts) — without this they'd
 * only refresh on an explicit user action. Mount once high in the tree
 * (Story 1.5 / gated boot). Keys are invalidated by prefix (no userId
 * needed) so this stays independent of any particular screen's hooks.
 */
export function useForegroundRefresh() {
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        queryClient.invalidateQueries({ queryKey: ['status'] });
        queryClient.invalidateQueries({ queryKey: ['config'] });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        queryClient.invalidateQueries({ queryKey: ['connections'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);
}
