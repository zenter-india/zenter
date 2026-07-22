// HallMate — Pure utility helpers. No DOM, no app state.

export const noop = () => {};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}

// E.164 normalizer for Indian mobile numbers. Returns null when invalid.
export function normalizePhoneIN(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return `+${digits}`;
  return null;
}

export function isValidOtp(code) {
  return /^\d{6}$/.test(String(code || '').trim());
}

export function formatPhonePretty(e164) {
  if (!e164) return '';
  const m = String(e164).match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

// Safe parser — never throws, returns fallback on failure.
export function safeJsonParse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export function uniqueBy(list, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Pull the current page's route key (e.g., "/login.html" -> "login").
export function currentRoute() {
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';
  return file.replace('.html', '') || 'index';
}

// Show blurred overlay for suspended/warned accounts. Returns true if suspended (blocks page init).
export function checkSuspended(me) {
  // Non-blocking: show one-time warning overlay for users whose appeal was dismissed.
  if (me?.suspension_warning) {
    const warn = document.createElement('div');
    warn.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);background:rgba(15,23,42,0.6);';
    warn.innerHTML = `
      <div style="background:var(--hm-surface,#fff);border-radius:20px;padding:36px 28px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h2 style="font-size:20px;font-weight:700;color:var(--hm-text,#0f172a);margin:0 0 10px;">Appeal Reviewed</h2>
        <p style="color:var(--hm-text-muted,#64748b);font-size:14px;line-height:1.8;margin:0 0 24px;">
          Dear Aspirant, Your matching function has been restored. Please regulate according to the guidelines and wish you a happy Zentering!
        </p>
        <button id="hm-warn-ack" style="display:block;width:100%;background:var(--hm-primary,#2563eb);color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;">
          I Understand
        </button>
      </div>`;
    document.body.appendChild(warn);
    warn.querySelector('#hm-warn-ack').addEventListener('click', async () => {
      warn.remove();
      const { dismissSuspensionWarning } = await import('./supabase.js');
      await dismissSuspensionWarning(me.id);
    });
  }

  // Blocking: show suspension screen — page init should not continue.
  if (me?.account_status !== 'suspended') return false;

  const overlay = document.createElement('div');
  overlay.id = 'hm-suspension-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);background:rgba(15,23,42,0.6);';

  overlay.innerHTML = `
    <div style="background:var(--hm-surface,#fff);border-radius:20px;padding:36px 28px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);">
      <div style="font-size:48px;margin-bottom:16px;">🚫</div>
      <h2 style="font-size:20px;font-weight:700;color:var(--hm-text,#0f172a);margin:0 0 10px;">Account Suspended</h2>
      <p style="color:var(--hm-text-muted,#64748b);font-size:14px;line-height:1.8;margin:0 0 24px;">
        Dear Aspirant, Our system has detected an suspicious activity that your actions violate the Community Guidelines.
      </p>
      <a href="mailto:support@zenter.in" style="display:block;width:100%;background:var(--hm-primary,#2563eb);color:#fff;border:none;border-radius:10px;padding:14px 24px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:16px;text-decoration:none;box-sizing:border-box;">
        Contact Support
      </a>
      <button id="hm-suspension-signout" style="background:none;border:none;color:var(--hm-text-muted,#64748b);font-size:13px;cursor:pointer;text-decoration:underline;padding:0;">
        Sign out
      </button>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#hm-suspension-signout').addEventListener('click', async () => {
    const { logout } = await import('./auth.js');
    await logout();
  });

  return true;
}

// Build a query-string URL.
export function buildUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  return url.toString();
}
