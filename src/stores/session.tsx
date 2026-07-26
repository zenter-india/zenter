import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, type User } from '@react-native-firebase/auth';

/**
 * Global auth session (AD-4). Firebase phone is the sole identity; `phone` (E.164)
 * is the app-wide user handle for backend calls. `ready` gates the boot splash
 * with a bounded timeout so a cold-start failure resolves as logged-out (FR-4).
 */
type SessionValue = {
  user: User | null;
  phone: string | null;
  ready: boolean;
};

const SessionContext = createContext<SessionValue>({ user: null, phone: null, ready: false });
export const useSession = () => useContext(SessionContext);

const AUTH_READY_TIMEOUT_MS = 8000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    const done = () => { if (!settled.current) { settled.current = true; setReady(true); } };
    const timer = setTimeout(done, AUTH_READY_TIMEOUT_MS);
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUser(u);
      done();
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  return (
    <SessionContext.Provider value={{ user, phone: user?.phoneNumber ?? null, ready }}>
      {children}
    </SessionContext.Provider>
  );
}
