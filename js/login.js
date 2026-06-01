// HallMate — Login page OTP flow.
// Loaded only from login.html. Handles: phone → send OTP → verify → post-login redirect.

import { auth, createRecaptcha, resetRecaptcha, signInWithPhoneNumber } from './firebase-config.js';
import { handlePostLogin, redirectIfAuthed } from './auth.js';
import { normalizePhoneIN } from './utils.js';
import { setButtonBusy } from './ui.js';

let confirmationResult = null;
let resendTimer = null;

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  // The login form is visible immediately (no blocking gate) — critical for
  // mobile where Firebase init can take a few seconds. We redirect already-
  // authenticated users in the background once auth resolves; the brief form
  // visibility for that rare case is far better than making EVERY logged-out
  // visitor wait on a spinner.
  redirectIfAuthed(); // fire-and-forget — navigates away if a session exists

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
  const phone = normalizePhoneIN(raw);

  if (!phone) {
    showError('phone', 'Enter a valid 10-digit Indian mobile number.');
    return;
  }

  clearError('phone');
  const btn = document.getElementById('hm-send-otp');
  setButtonBusy(btn, true, 'Sending…');

  try {
    // Singleton verifier — same instance across retries. Firebase handles
    // re-execution and token refresh internally; manual clear-on-every-click
    // caused "already rendered" + flicker bugs in the previous version.
    const verifier = createRecaptcha('hm-recaptcha-container');
    confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);

    document.getElementById('hm-otp-target').textContent = phone;
    showStep('otp');
    startResendCountdown(30);
    document.getElementById('hm-otp-1')?.focus();
  } catch (err) {
    console.error('[login] sendOtp', err);
    // Tear down the cached verifier so the next attempt gets a clean one.
    resetRecaptcha();
    showError('phone', toMessage(err));
  } finally {
    setButtonBusy(btn, false);
  }
}

// ─── Verify OTP ──────────────────────────────────────────────────────────────

async function verifyOtp() {
  if (!confirmationResult) { showStep('phone'); return; }

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
    const result = await confirmationResult.confirm(code);
    await handlePostLogin(result.user); // redirects — execution ends here
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

// Maps Firebase error codes to human-readable messages.
function toMessage(err) {
  const MAP = {
    'auth/invalid-phone-number':      'Invalid phone number. Use 10 digits without country code.',
    'auth/too-many-requests':         'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-verification-code': 'Incorrect code. Please check and try again.',
    'auth/code-expired':              'Code expired. Request a new one.',
    'auth/missing-phone-number':      'Enter your mobile number.',
    'auth/quota-exceeded':            'SMS quota exceeded. Try again later.',
    'auth/captcha-check-failed':      'reCAPTCHA failed. Please refresh and try again.',
    'auth/network-request-failed':    'Network error. Check your connection.',
    'auth/user-disabled':             'This account has been disabled.',
  };
  return MAP[err?.code] || 'Something went wrong. Please try again.';
}

document.addEventListener('DOMContentLoaded', init);
