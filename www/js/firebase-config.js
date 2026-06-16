// HallMate — Firebase initialization (Phone OTP only).
// Architecture-only: exposes the configured `auth` instance and OTP primitives.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

import { FIREBASE } from './config.js';

const firebaseApp = initializeApp({
  apiKey: FIREBASE.apiKey,
  authDomain: FIREBASE.authDomain,
  projectId: FIREBASE.projectId,
  appId: FIREBASE.appId,
});

export const auth = getAuth(firebaseApp);

// Testing mode is enabled ONLY for Playwright E2E runs.
// Playwright injects `window.__hm_e2e = true` via addInitScript() before any
// module loads. With this flag ON, Firebase accepts fixed test OTPs for phone
// numbers registered in the Firebase Console test list — real SMS is bypassed.
// In production this flag is never present, so real SMS OTP delivery is used.
if (typeof window !== 'undefined' && window.__hm_e2e) {
  auth.settings.appVerificationDisabledForTesting = true;
}

// Keep sessions across reloads. Phone-OTP-only apps want local persistence.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('[firebase] persistence init failed', err);
});

// Re-export OTP primitives so feature modules import a single surface.
export { signInWithPhoneNumber, onAuthStateChanged, signOut };

// ApplicationVerifier — singleton pattern.
//
// One RecaptchaVerifier instance is created lazily on first call to
// createRecaptcha() and reused for every subsequent signInWithPhoneNumber()
// call in the same page session. This matches Firebase's documented
// guidance: the verifier is designed to be reusable across multiple OTP
// requests; the token it produces is single-use but the verifier instance
// itself is not. Recreating per click triggers duplicate render warnings,
// flickering badges, and occasional "already rendered" failures.
//
// • E2E / Playwright (window.__hm_e2e = true):
//     No-op mock (NOT cached — tests stay isolated).
//
// • Production: invisible reCAPTCHA, singleton.
let verifierInstance = null;

export function createRecaptcha(containerId = 'hm-recaptcha-container') {
  if (typeof window !== 'undefined' && window.__hm_e2e) {
    return {
      type:   'recaptcha',
      verify: () => Promise.resolve(''),
      clear:  () => {},
      render: () => Promise.resolve(0),
      _reset: () => {},
    };
  }

  if (verifierInstance) return verifierInstance;

  verifierInstance = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback:           () => {},
    'expired-callback': () => { console.warn('[recaptcha] expired — verifier will refresh on next attempt'); },
    'error-callback':   (err) => { console.warn('[recaptcha] check failed', err); },
  });

  return verifierInstance;
}

// Tear down the cached verifier so the next createRecaptcha() returns a fresh
// instance. Call on auth errors so a stale or rate-limited verifier doesn't
// poison subsequent retries. Safe to call when no verifier exists.
export function resetRecaptcha() {
  if (!verifierInstance) return;
  try { verifierInstance.clear(); } catch { /* defensive — clear can throw on already-disposed */ }
  verifierInstance = null;
}
