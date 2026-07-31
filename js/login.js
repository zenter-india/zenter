// HallMate — Login page OTP flow.
// Loaded only from login.html. Handles: phone → send OTP → verify → post-login redirect.
//
// Runs on Supabase Auth's phone provider (Twilio Verify backend) — replaces
// the former Firebase Phone Auth + invisible reCAPTCHA + Capacitor-native
// bridge. signInWithOtp/verifyOtp is identical whether this page is loaded in
// a plain browser tab or the Capacitor-wrapped native shell, so there's a
// single code path for both now — no reCAPTCHA, no native branch.

import { supabase } from './supabase.js';
import { handlePostLogin, redirectIfAuthed } from './auth.js';
import { normalizePhoneIN } from './utils.js';
import { setButtonBusy } from './ui.js';
import { STORAGE_KEYS, ROUTES } from './config.js';

let phone = null;
let resendTimer = null;

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  // FAST PATH — synchronous sessionStorage check. If the user is already
  // authenticated (session cached from a previous visit), redirect instantly
  // before the form ever renders. This eliminates the "login page flashes
  // briefly then redirects" glitch (e.g. Contact Us → Back to Sign In).
  try {
    const cachedUser = sessionStorage.getItem(STORAGE_KEYS.authUser);
    const completed  = sessionStorage.getItem(STORAGE_KEYS.profileCompleted);
    if (cachedUser && completed === 'true') {
      window.location.replace(ROUTES.dashboard);
      return; // don't render or wire the form at all
    }
  } catch { /* sessionStorage unavailable in some private-mode browsers */ }

  // ASYNC PATH — Supabase confirms the session (covers cold-start / no-cache).
  // If there's any cached auth user (even without profileCompleted), hide the
  // form while it resolves to avoid a flash of the login UI before redirect.
  const card = document.querySelector('.hm-auth__card');
  try {
    if (sessionStorage.getItem(STORAGE_KEYS.authUser) && card) card.hidden = true;
  } catch {}

  const redirected = await redirectIfAuthed();
  if (!redirected && card) card.hidden = false; // not logged in — show the form

  document.getElementById('hm-form-phone').addEventListener('submit', (e) => {
    e.preventDefault();
    sendOtp();
  });

  document.getElementById('hm-form-otp').addEventListener('submit', (e) => {
    e.preventDefault();
    verifyOtp();
  });

  document.getElementById('hm-otp-back').addEventListener('click', () => showStep('phone'));

  document.getElementById('hm-otp-resend').addEventListener('click', (e) => {
    e.preventDefault();
    if (!e.currentTarget.dataset.disabled) sendOtp();
  });

  initOtpCells();
}

// ─── Send OTP ────────────────────────────────────────────────────────────────

async function sendOtp() {
  const raw = document.getElementById('hm-phone').value.trim();
  const normalized = normalizePhoneIN(raw);

  if (!normalized) {
    showError('phone', 'Enter a valid 10-digit Indian mobile number.');
    return;
  }

  clearError('phone');
  const btn = document.getElementById('hm-send-otp');
  setButtonBusy(btn, true, 'Sending…');

  try {
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) throw error;

    phone = normalized;
    document.getElementById('hm-otp-target').textContent = phone;
    showStep('otp');
    startResendCountdown(30);
    document.getElementById('hm-otp-1')?.focus();
  } catch (err) {
    console.error('[login] sendOtp', err);
    showError('phone', toMessage(err));
  } finally {
    setButtonBusy(btn, false);
  }
}

// ─── Verify OTP ──────────────────────────────────────────────────────────────

async function verifyOtp() {
  if (!phone) { showStep('phone'); return; }

  const cells = Array.from(document.querySelectorAll('.hm-otp__cell'));
  const code = cells.map((c) => c.value).join('');

  if (!/^\d{6}$/.test(code)) {
    showError('otp', 'Enter the complete 6-digit code.');
    return;
  }

  clearError('otp');
  const btn = document.querySelector('#hm-form-otp [type="submit"]');
  setButtonBusy(btn, true, 'Verifying…');

  try {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error) throw error;

    // Bridge this Supabase Auth session to the caller's existing users row by
    // phone match (see supabase/migrations/20260708_01_auth_link.sql). Safe to
    // call unconditionally — idempotent, and a null result just means a
    // genuinely new user with no existing row yet (onboarding's own insert
    // sets auth_uid in that case).
    const { error: linkError } = await supabase.rpc('link_auth_account');
    if (linkError) console.warn('[login] link_auth_account failed (expected for new users)', linkError.message);

    await handlePostLogin(data.user); // redirects — execution ends here
  } catch (err) {
    console.error('[login] verifyOtp', err);
    showError('otp', toMessage(err));
    cells.forEach((c) => { c.value = ''; });
    cells[0]?.focus();
    setButtonBusy(btn, false);
  }
}

// ─── OTP cell keyboard UX ────────────────────────────────────────────────────

function initOtpCells() {
  const cells = Array.from(document.querySelectorAll('.hm-otp__cell'));

  cells.forEach((cell, i) => {
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !cell.value && i > 0) {
        e.preventDefault();
        cells[i - 1].value = '';
        cells[i - 1].focus();
      }
      // Allow only digit keys and control keys
      if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
    });

    cell.addEventListener('input', () => {
      cell.value = cell.value.replace(/\D/g, '').slice(-1);
      if (cell.value && i < cells.length - 1) cells[i + 1].focus();
      if (cells.every((c) => c.value)) {
        document.getElementById('hm-form-otp').requestSubmit();
      }
    });

    cell.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      [...digits].slice(0, 6).forEach((d, j) => { if (cells[j]) cells[j].value = d; });
      const nextFocus = Math.min(digits.length, cells.length - 1);
      cells[nextFocus]?.focus();
      if (digits.length >= 6) document.getElementById('hm-form-otp').requestSubmit();
    });
  });
}

// ─── Resend countdown ────────────────────────────────────────────────────────

function startResendCountdown(seconds) {
  const link = document.getElementById('hm-otp-resend');
  clearInterval(resendTimer);
  link.dataset.disabled = '1';
  let t = seconds;

  const tick = () => {
    link.textContent = `Resend in ${t}s`;
    if (t-- <= 0) {
      clearInterval(resendTimer);
      delete link.dataset.disabled;
      link.textContent = 'Resend OTP';
    }
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

// ─── Step visibility ─────────────────────────────────────────────────────────

function showStep(step) {
  document.getElementById('hm-form-phone').hidden = step !== 'phone';
  document.getElementById('hm-form-otp').hidden  = step !== 'otp';
  clearError('phone');
  clearError('otp');
}

// ─── Error display ───────────────────────────────────────────────────────────

function showError(scope, message) {
  const el = document.getElementById(`hm-error-${scope}`);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function clearError(scope) {
  const el = document.getElementById(`hm-error-${scope}`);
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

// Maps Supabase Auth errors to human-readable messages.
//
// BEST-EFFORT pending empirical verification (mirrors the mobile app's
// src/features/auth/phoneAuth.ts): Supabase's error `code` vocabulary for
// phone-OTP isn't as documented as Firebase's `auth/*` strings — this keys
// first on `err.code` where GoTrue does supply one, falling back to matching
// `err.message` substrings. Confirm these against real responses.
function toMessage(err) {
  const CODES = {
    over_sms_send_rate_limit: 'Too many attempts. Please wait a moment and try again.',
    sms_send_failed: 'Could not send the code. Please try again.',
    over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
    otp_expired: 'Code expired. Request a new one.',
    invalid_credentials: 'Incorrect code. Please check and try again.',
    validation_failed: 'Invalid phone number. Use 10 digits without country code.',
  };
  if (err?.code && CODES[err.code]) return CODES[err.code];

  const message = err?.message || '';
  if (/invalid.*phone/i.test(message)) return 'Invalid phone number. Use 10 digits without country code.';
  if (/token.*expired|invalid/i.test(message)) return 'Incorrect or expired code. Please check and try again.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
  if (/network/i.test(message)) return 'Network error. Check your connection.';
  return 'Something went wrong. Please try again.';
}

document.addEventListener('DOMContentLoaded', init);
