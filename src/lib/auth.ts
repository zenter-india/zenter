import { supabase } from '@/api/client';
import { queryClient } from '@/data/queryClient';
import { storage } from './storage';

/**
 * Logout (FR-35): sign out of Supabase Auth, drop the query cache, and clear
 * session storage. Per-user-scoped keys (chat read-state, connections-seen)
 * deliberately survive, matching web. Navigation reset to the auth stack is
 * done by the caller.
 */
export async function logout(): Promise<void> {
  try { await supabase.auth.signOut(); } finally {
    queryClient.clear();
    await storage.clearSession();
  }
}
