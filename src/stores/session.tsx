import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/api/client';

/**
 * Global auth session. Supabase Auth (phone OTP via Twilio Verify) is the
 * identity system; `phone` (E.164) is the app-wide user handle for backend
 * calls. `ready` gates the boot splash with a bounded timeout so a cold-start
 * failure resolves as logged-out.
 *
 * `phone` is read off `user.phone` — Supabase's own field, not `+`-prefixed
 * per its docs convention (e.g. `919999999999`, not `+919999999999`).
 * Reconciled to the app's `+91...` convention here so every downstream
 * consumer (getUserByPhone, resolvePostAuthRoute, etc.) keeps seeing the same
 * format it always has.
 */
type SessionValue = {
  user: User | null;
  phone: string | null;
  ready: boolean;
};

const SessionContext = createContext<SessionValue>({ user: null, phone: null, ready: false });
export const useSession = () => useContext(SessionContext);

const AUTH_READY_TIMEOUT_MS = 8000;

function toE164(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  return rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
}

// Synchronous mirror of the current phone for non-component, fire-and-forget
// call sites (src/lib/observability.ts's track()) that can't await a hook or
// Supabase's async getSession(). Updated in lockstep with the context below.
let currentPhone: string | null = null;
export function getCurrentPhone(): string | null {
  return currentPhone;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    const done = () => { if (!settled.current) { settled.current = true; setReady(true); } };
    const timer = setTimeout(done, AUTH_READY_TIMEOUT_MS);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      currentPhone = toE164(session?.user?.phone);
      done();
    });
    return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  return (
    <SessionContext.Provider value={{ user, phone: toE164(user?.phone), ready }}>
      {children}
    </SessionContext.Provider>
  );
}
