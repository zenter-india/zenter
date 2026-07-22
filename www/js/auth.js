import { auth, onAuthStateChanged, signOut } from './firebase-config.js';
import { getUserByPhone } from './supabase.js';
import { STORAGE_KEYS, ROUTES } from './config.js';

const listeners = new Set();
let currentUser = null;
let ready = false;

onAuthStateChanged(auth, (user) => {
  currentUser = user ? { uid: user.uid, phoneNumber: user.phoneNumber } : null;

  if (currentUser) {
    sessionStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(currentUser));
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.authUser);
  }

  ready = true;
  listeners.forEach((fn) => {
    try { fn(currentUser); } catch (err) { console.error('[auth] listener error', err); }
  });
});

export function getCurrentUser() { return currentUser; }
export function isReady() { return ready; }

export function onAuthChange(fn) {
  listeners.add(fn);
  if (ready) fn(currentUser);
  return () => listeners.delete(fn);
}

// Resolves with the current user once Firebase reports auth state.
// A safety timeout GUARANTEES this always resolves (default 8s) so the UI can
// never deadlock on a permanent loader if onAuthStateChanged never fires
// (Firebase cold-start failure, blocked network, ad-blockers, etc.). On timeout
// it resolves with whatever currentUser we have — null is treated as logged-out,
// which deterministically routes the user to login rather than hanging forever.
export function whenReady(timeoutMs = 8000) {
  if (ready) return Promise.resolve(currentUser);
  return new Promise((resolve) => {
    let settled = false;
    let off = () => {};
    const finish = () => {
      if (settled) return;
      settled = true;
      try { off(); } catch { /* ignore */ }
      resolve(currentUser);
    };
    off = onAuthChange(() => finish());
    setTimeout(finish, timeoutMs);
  });
}

// Called immediately after a successful OTP confirmation.
// Checks Supabase users table by phone to decide where to send the user.
export async function handlePostLogin(firebaseUser) {
  try {
    const { data, error } = await getUserByPhone(firebaseUser.phoneNumber);
    const hasProfile = !error && data?.profile_completed === true;
    // Cache so guards + navbar can read without an extra Supabase round-trip.
    try { sessionStorage.setItem(STORAGE_KEYS.profileCompleted, String(hasProfile)); } catch {}
    const pending = sessionStorage.getItem(STORAGE_KEYS.redirectAfterLogin);
    const destination = hasProfile ? (pending || ROUTES.dashboard) : ROUTES.onboarding;
    sessionStorage.removeItem(STORAGE_KEYS.redirectAfterLogin);
    window.location.replace(destination);
  } catch (err) {
    console.error('[auth] handlePostLogin error', err);
    window.location.replace(ROUTES.onboarding);
  }
}

export async function logout(redirectTo = ROUTES.landing) {
  await signOut(auth);
  sessionStorage.removeItem(STORAGE_KEYS.authUser);
  sessionStorage.removeItem(STORAGE_KEYS.profileCompleted);
  sessionStorage.removeItem('hm.user.role'); // admin cache
  window.location.assign(redirectTo);
}

// Ensures both Firebase auth AND onboarding completion before granting access.
// Uses a sessionStorage cache so most calls are instant (no extra Supabase fetch).
// Falls back to a single getUserByPhone() when the cache is absent (e.g. after
// a browser restart that clears sessionStorage).
export async function requireOnboarded() {
  const user = await requireAuth();
  if (!user) return null;

  const cached = sessionStorage.getItem(STORAGE_KEYS.profileCompleted);

  if (cached === 'true')  return user;
  if (cached === 'false') { window.location.replace(ROUTES.onboarding); return null; }

  // Cache miss — fetch once and populate.
  const { data } = await getUserByPhone(user.phoneNumber);
  const completed = !!(data?.profile_completed);
  try { sessionStorage.setItem(STORAGE_KEYS.profileCompleted, String(completed)); } catch {}

  if (!completed) { window.location.replace(ROUTES.onboarding); return null; }
  return user;
}

// Redirect to login when not authenticated. Saves intended destination.
export async function requireAuth(redirectTo = ROUTES.login) {
  const user = await whenReady();
  if (!user) {
    sessionStorage.setItem(STORAGE_KEYS.redirectAfterLogin, window.location.pathname);
    window.location.replace(redirectTo);
    return null;
  }
  return user;
}

// On the login page: skip the flow if already signed in.
// Returns true when a redirect was triggered (caller should keep its loading
// gate up while the browser navigates away — avoids flashing the login form).
export async function redirectIfAuthed(redirectTo = ROUTES.dashboard) {
  const user = await whenReady();
  if (user) { window.location.replace(redirectTo); return true; }
  return false;
}

// ─── Admin guard ─────────────────────────────────────────────────────────────
// Requires Firebase auth + Supabase role='admin'. Caches role in sessionStorage
// so admin pages render instantly on subsequent navigations (no flicker).
// Non-admin users are bounced to /dashboard.html — never see admin UI.
const ROLE_CACHE_KEY = 'hm.user.role';

export async function requireAdmin() {
  const user = await whenReady();
  if (!user) {
    sessionStorage.setItem(STORAGE_KEYS.redirectAfterLogin, window.location.pathname);
    window.location.replace(ROUTES.login);
    return null;
  }

  // Fast path: cached admin role from a previous visit this session
  try {
    if (sessionStorage.getItem(ROLE_CACHE_KEY) === 'admin') return user;
  } catch { /* private mode */ }

  // Slow path: ask Supabase
  const { getRoleByPhone } = await import('./supabase.js');
  const { data, error } = await getRoleByPhone(user.phoneNumber);
  const role = error ? null : (data?.role || 'user');
  try { sessionStorage.setItem(ROLE_CACHE_KEY, role || 'user'); } catch {}

  if (role !== 'admin') {
    window.location.replace(ROUTES.dashboard); // bounce non-admins, no UI flash
    return null;
  }
  return user;
}

/** Synchronous cached-role read. Returns 'user' / 'moderator' / 'admin' / null. */
export function getCachedRole() {
  try { return sessionStorage.getItem(ROLE_CACHE_KEY) || null; }
  catch { return null; }
}
